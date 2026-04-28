const assert = require('node:assert/strict')

const { isNonConformityAlertEventEnabled } = require('../src/lib/sst/nonConformityAlertRules')

const config = { eventCreatedEnabled: true, eventUpdatedEnabled: false }
assert.equal(isNonConformityAlertEventEnabled('NC_CREATED', config), true)
assert.equal(isNonConformityAlertEventEnabled('NC_UPDATED', config), false)
assert.equal(isNonConformityAlertEventEnabled('ACTION_ITEM_ASSIGNED', config), true)

const configWithUpdates = { eventCreatedEnabled: false, eventUpdatedEnabled: true }
assert.equal(isNonConformityAlertEventEnabled('NC_UPDATED', configWithUpdates), true)
assert.equal(isNonConformityAlertEventEnabled('NC_CREATED', configWithUpdates), false)

console.log('nc-alert-admin-config behavior ok')
