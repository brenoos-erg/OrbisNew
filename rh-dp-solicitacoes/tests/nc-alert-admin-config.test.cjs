const assert = require('node:assert/strict')

const { isNonConformityAlertEventEnabled } = require('../src/lib/sst/nonConformityAlertRules')

const config = { eventCreatedEnabled: true, eventUpdatedEnabled: false }
assert.equal(isNonConformityAlertEventEnabled('created', config), true)
assert.equal(isNonConformityAlertEventEnabled('updated', config), false)
assert.equal(isNonConformityAlertEventEnabled('retroactive', config), false)

const configWithUpdates = { eventCreatedEnabled: false, eventUpdatedEnabled: true }
assert.equal(isNonConformityAlertEventEnabled('updated', configWithUpdates), true)
assert.equal(isNonConformityAlertEventEnabled('migrated', configWithUpdates), true)

console.log('nc-alert-admin-config behavior ok')