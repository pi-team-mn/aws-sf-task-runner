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

runForever(myProcessor).catch(err => console.error(err));
```
