let cron = require('node-cron');
let service = require('./nerdpoints-service');

cron.schedule("0 0 0 1/1 * *", () => {
    service.reset();
})
