# aws-sf-task-runner
Continuously fetch and run an AWS Step Function activity task

```javascript
import { runForever } from './task-runner';

// Your own custom processor
// input will be a
function myProcessor(input) {
    console.log(input);
    return {'your own': 'custom result'};
}

runForever(myProcessor).catch(err => console.error(err));
```
