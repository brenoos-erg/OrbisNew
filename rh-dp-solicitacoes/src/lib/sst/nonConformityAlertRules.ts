export type NonConformityAlertTrigger = 'created' | 'updated' | 'migrated' | 'retroactive'

export function isNonConformityAlertEventEnabled(
  trigger: NonConformityAlertTrigger,
  config: { eventCreatedEnabled: boolean; eventUpdatedEnabled: boolean },
) {
  if (trigger === 'created') return config.eventCreatedEnabled
  if (trigger === 'updated') return config.eventUpdatedEnabled
  return config.eventUpdatedEnabled
}