const assert = require('node:assert/strict')
const fs = require('node:fs')

const notificationLib = fs.readFileSync('src/lib/sst/nonConformityNotifications.ts', 'utf8')
const configLib = fs.readFileSync('src/lib/sst/nonConformityAlertConfig.ts', 'utf8')

const ncCreatedBlock = notificationLib.match(/case 'NC_CREATED':[\s\S]*?break/)?.[0] ?? ''
const ncUpdatedBlock = notificationLib.match(/case 'NC_UPDATED':[\s\S]*?break/)?.[0] ?? ''
const switchBody = notificationLib.slice(notificationLib.indexOf('switch (input.event)'))
const actionCompletedBlock = switchBody.match(/case 'ACTION_ITEM_COMPLETED':[\s\S]*?break/)?.[0] ?? ''
const effectivenessBlock = switchBody.match(/case 'EFFECTIVENESS_REVIEW_REQUESTED':[\s\S]*?break/)?.[0] ?? ''
const retroactiveBlock = notificationLib.match(/export async function notifyRetroactiveOpenNonConformities[\s\S]*?\n}/)?.[0] ?? ''
const defaultBodyBlock = configLib.match(/const DEFAULT_BODY = \[([\s\S]*?)\]\.join/)?.[0] ?? ''

assert.match(ncCreatedBlock, /centro envolvido/)
assert.match(ncCreatedBlock, /solicitante/)
assert.doesNotMatch(ncCreatedBlock, /quality\.recipients/)
assert.doesNotMatch(ncCreatedBlock, /includeConfiguredRecipients = true/)

assert.match(ncUpdatedBlock, /centro envolvido/)
assert.match(ncUpdatedBlock, /solicitante/)
assert.match(ncUpdatedBlock, /responsável da ação/)
assert.match(ncUpdatedBlock, /if \(input\.actionItemId\) addRecipients\('responsável da ação'/)
assert.doesNotMatch(ncUpdatedBlock, /quality\.recipients/)
assert.doesNotMatch(ncUpdatedBlock, /includeConfiguredRecipients = true/)

assert.match(actionCompletedBlock, /quality\.recipients/)
assert.match(effectivenessBlock, /quality\.recipients/)
assert.match(notificationLib, /motivos=\$\{recipientReasons/)
assert.match(notificationLib, /evento=\$\{input\.event\}/)
assert.match(notificationLib, /RECIPIENT_REASON_DESCRIPTIONS/)
assert.match(notificationLib, /Você recebeu este alerta porque é o solicitante da NC\./)
assert.match(notificationLib, /Você recebeu este alerta porque está vinculado ao centro de custo envolvido na NC\./)
assert.match(notificationLib, /Você recebeu este alerta porque é responsável por uma ação do plano\./)
assert.match(notificationLib, /sendMail\(\{ to: \[recipient\.email\]/)
assert.match(notificationLib, /formatRecipientReasonExplanation\(recipient\)/)
assert.match(notificationLib, /motivoEnvio: formatRecipientReasonExplanation\(recipient\)/)
assert.doesNotMatch(notificationLib, /responsavel:\s*resolved\.recipients\[0\]/)
assert.match(notificationLib, /const responsibleName = await resolveActionPlanResponsibleName\(input\.actionItemId, db\) \?\? '-'/)
assert.match(notificationLib, /responsavel: responsibleName/)

assert.match(retroactiveBlock, /confirmation-required/)
assert.match(retroactiveBlock, /event: 'NC_UPDATED'/)
assert.doesNotMatch(retroactiveBlock, /quality\.recipients|includeConfiguredRecipients = true/)
assert.match(notificationLib, /message: \{ startsWith: resolved\.marker \}/)

assert.match(configLib, /NC \{\{numeroRnc\}\}: atualização registrada/)
assert.match(configLib, /LEGACY_RESPONSIBLE_TEMPLATE_LINE = 'Responsável: \{\{responsavel\}\}'/)
assert.match(configLib, /SAFE_REASON_TEMPLATE_LINE = 'Motivo do envio: \{\{motivoEnvio\}\}'/)
assert.match(configLib, /normalizeNonConformityAlertBodyTemplate/)
assert.match(configLib, /replaceAll\(LEGACY_RESPONSIBLE_TEMPLATE_LINE, SAFE_REASON_TEMPLATE_LINE\)/)
assert.match(configLib, /prisma\.nonConformityAlertConfig\.update/)
assert.match(configLib, /Motivo do envio: \{\{motivoEnvio\}\}/)
assert.doesNotMatch(defaultBodyBlock, /Responsável: \{\{responsavel\}\}/)
assert.doesNotMatch(configLib, /ação necessária/)

console.log('non-conformity-notification-scope-regression ok')
