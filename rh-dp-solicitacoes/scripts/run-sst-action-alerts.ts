const { runActionDueAlerts } = require('../src/lib/sst/actionDueAlerts')

runActionDueAlerts()
  .then((summary: unknown) => {
    console.log('SST action due alerts summary', summary)
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error('SST action due alerts failed', error)
    process.exit(1)
  })
