const assert = require('node:assert/strict')
const fs = require('node:fs')

const recipients = fs.readFileSync('src/lib/documents/documentNotificationRecipients.ts', 'utf8')

assert.match(recipients, /if \(input\.notifyAuthor\)/)
assert.match(recipients, /if \(input\.notifyApproverGroup\)/)
assert.match(recipients, /if \(input\.notifyQualityReviewers\)/)
assert.match(recipients, /if \(input\.notifyDistributionTargets && input\.versionId\)/)
assert.match(recipients, /new Map<string, ResolvedNotificationRecipient>\(\)/)
assert.match(recipients, /if \(!deduped\.has\(item\.email\)\) deduped\.set\(item\.email, item\)/)
assert.match(recipients, /origin: 'fixedEmails'/)

console.info('document-notification-recipients-resolution.test.cjs: ok')
