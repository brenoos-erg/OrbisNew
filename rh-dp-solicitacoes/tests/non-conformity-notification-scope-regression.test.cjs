const assert = require('node:assert/strict')
const fs = require('node:fs')

const notificationLib = fs.readFileSync('src/lib/sst/nonConformityNotifications.ts', 'utf8')
const configLib = fs.readFileSync('src/lib/sst/nonConformityAlertConfig.ts', 'utf8')

const ncCreatedBlock = notificationLib.match(/case 'NC_CREATED':[\s\S]*?break/)?.[0] ?? ''
const ncUpdatedBlock = notificationLib.match(/case 'NC_UPDATED':[\s\S]*?break/)?.[0] ?? ''
const switchBody = notificationLib.slice(notificationLib.indexOf('switch (input.event)'))
const actionCompletedBlock = switchBody.match(/case 'ACTION_ITEM_COMPLETED':[\s\S]*?break/)?.[0] ?? ''
const effectivenessBlock = switchBody.match(/case 'EFFECTIVENESS_REVIEW_REQUESTED':[\s\S]*?break/)?.[0] ?? ''

assert.match(ncCreatedBlock, /centro envolvido/)
assert.match(ncCreatedBlock, /solicitante/)
assert.doesNotMatch(ncCreatedBlock, /quality\.recipients/)
assert.doesNotMatch(ncCreatedBlock, /includeConfiguredRecipients = true/)

assert.match(ncUpdatedBlock, /centro envolvido/)
assert.match(ncUpdatedBlock, /solicitante/)
assert.match(ncUpdatedBlock, /responsável da ação/)
assert.doesNotMatch(ncUpdatedBlock, /quality\.recipients/)
assert.doesNotMatch(ncUpdatedBlock, /includeConfiguredRecipients = true/)

assert.match(actionCompletedBlock, /quality\.recipients/)
assert.match(effectivenessBlock, /quality\.recipients/)
assert.match(notificationLib, /motivos=\$\{recipientReasons/)
assert.match(configLib, /NC \{\{numeroRnc\}\}: atualização registrada/)
assert.doesNotMatch(configLib, /ação necessária/)

console.log('non-conformity-notification-scope-regression ok')
