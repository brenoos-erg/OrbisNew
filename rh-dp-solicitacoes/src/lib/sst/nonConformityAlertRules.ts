export type NonConformityNotificationEvent =
  | 'NC_CREATED'
  | 'NC_APPROVED_BY_QUALITY'
  | 'NC_REJECTED_BY_QUALITY'
  | 'NC_UPDATED'
  | 'NC_REOPENED'
  | 'NC_CANCELLED'
  | 'NC_CLOSED'
  | 'ACTION_PLAN_CREATED'
  | 'ACTION_ITEM_ASSIGNED'
  | 'ACTION_ITEM_UPDATED'
  | 'ACTION_ITEM_COMPLETED'
  | 'ACTION_PLAN_COMPLETED'
  | 'EFFECTIVENESS_REVIEW_REQUESTED'
  | 'EFFECTIVENESS_APPROVED'
  | 'EFFECTIVENESS_REJECTED'

export function isNonConformityAlertEventEnabled(
  event: NonConformityNotificationEvent,
  config: { eventCreatedEnabled: boolean; eventUpdatedEnabled: boolean },
) {
  if (event === 'NC_CREATED') return config.eventCreatedEnabled
  if (event === 'NC_UPDATED') return config.eventUpdatedEnabled
  return true
}
