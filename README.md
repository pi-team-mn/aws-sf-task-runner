# aws-sf-task-runner
Continuously fetch and run an AWS Step Function activity task

```javascript
import { runForever } from './task-runner';

// Your own custom processor
// > input will be already JSON parsed by the task runner
// > the task runner will also JSON stringify you return value
function myProcessor(input) {
    console.log(input);
    return {'your own': 'custom result'};
}

// The task name should be set as an anvironment variable:
process.env.TASK_NAME='your-task-name-is-the-last-part-of-the-activity-arn';

runForever(myProcessor).catch(err => console.error(err));
```
