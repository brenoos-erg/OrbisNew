export const NON_CONFORMITY_FIRST_SCREEN_FIELDS = [
  'tipoNc',
  'descricao',
  'evidenciaObjetiva',
  'referenciaSig',
  'acoesImediatas',
  'planoAcaoCodigo',
  'planoAcaoObjetivo',
  'planoAcaoEvidencias',
] as const

export function isEditingFirstScreen(touchedFields: string[]) {
  return touchedFields.some((key) => NON_CONFORMITY_FIRST_SCREEN_FIELDS.includes(key as (typeof NON_CONFORMITY_FIRST_SCREEN_FIELDS)[number]))
}

export function canEditFirstScreen(hasLevel3Access: boolean, touchedFields: string[]) {
  if (!isEditingFirstScreen(touchedFields)) return true
  return hasLevel3Access
}