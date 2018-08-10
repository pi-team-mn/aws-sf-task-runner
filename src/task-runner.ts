#!/usr/bin/env node

import { envkey } from '@pi-team-mn/envkey';
import * as AWS from 'aws-sdk';
import { hostname } from 'os';
import promiseRetry = require('promise-retry');

AWS.config.update({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-west-1' });

if (process.env.HTTPS_PROXY) {
    console.log('HTTPS_PROXY environment var set, will use proxy-agent. If this fails try installing it first: npm i proxy-agent');
    // tslint:disable-next-line:no-var-requires
    const proxy = require('proxy-agent');
    AWS.config.update({ httpOptions: { agent: proxy(process.env.HTTPS_PROXY) } });
}

const SF = new AWS.StepFunctions();
const taskName = envkey('TASK_NAME');

async function logAndRetry(err: any, retry: Function) {
    console.error(`${new Date().toISOString()} ERROR (will retry)`, err);
    return retry(err);
}

async function retryForever<T>(prom: Promise<T>): Promise<T> {
    const options = {
        forever: true,
        maxTimeout: 1000 * 60 * 30, // 30 minuten
    };
    return await promiseRetry(async retry => prom.catch(async err => logAndRetry(err, retry)), options);
}

async function retryElseSwallow<T>(prom: Promise<T>): Promise<T | void> {
    const options = {
        retries: 20,
        maxTimeout: 1000 * 60 * 30, // 30 minuten
    };
    try {
        await promiseRetry(async retry => prom.catch(async err => logAndRetry(err, retry)), options);
    } catch (err) {
        console.error(`${new Date().toISOString()} ERROR (swallowed)`, err);
    }
}

async function timedProcessing(fn: Function, input: any) {
    const start = new Date();
    const result = await fn(input);
    console.log(
        `${new Date().toISOString()} INFO Processing complete (${(new Date().valueOf() - start.valueOf()) / 1000} sec.)`
    );
    return result;
}

export async function runForever(activityTaskProcessor: ActivityTaskProcessor) {

    const accountId = (await new AWS.STS().getCallerIdentity().promise()).Account;
    const activityArn = `arn:aws:states:${AWS.config.region}:${accountId}:activity:${taskName}`;

    // ensure activity exists
    await SF.describeActivity({ activityArn }).promise();

    const nrCoroutines = parseInt(process.env.NR_COROUTINES || '10');
    await Promise.all([...Array(nrCoroutines).keys()].map(async i => runCoroutine(i + 1)));

    async function runCoroutine(nr: number) {
        const workerName = `${hostname()}-coroutine-${nr}`;
        console.log(`${new Date().toISOString()} INFO Coroutine ${workerName}: Awaiting activity task ${activityArn}...`);
        while (true) {
            const { taskToken, input } = await retryForever(SF.getActivityTask({ activityArn, workerName }).promise());
            if (!taskToken || !input) {
                continue;
            }
            console.log(`INFO got activity task ${input}`);
            let result: any;
            try {
                result = await timedProcessing(activityTaskProcessor, JSON.parse(input));
            } catch (err) {
                console.error(`${new Date().toISOString()} ERROR`, err);
                const error = `${err}`.slice(0, 256);
                await retryElseSwallow(SF.sendTaskFailure({ taskToken, cause: err.stack || err, error }).promise());
                continue;
            }
            await retryElseSwallow(SF.sendTaskSuccess({ taskToken, output: JSON.stringify(result || {}) }).promise());
        }
    }
}

export type ActivityTaskProcessor = (input: any) => any;
