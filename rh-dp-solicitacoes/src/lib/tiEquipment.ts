import { FEATURE_KEYS } from '@/lib/featureKeys'

export const TI_EQUIPMENT_CATEGORIES = [
  {
    value: 'LINHA_TELEFONICA',
    label: 'Linha telefônica',
    slug: 'linha-telefonica',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.LINHA_TELEFONICA,
  },
  {
    value: 'SMARTPHONE',
    label: 'Smartphone',
    slug: 'smartphones',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.SMARTPHONE,
  },
  {
    value: 'NOTEBOOK',
    label: 'Notebook',
    slug: 'notebooks',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.NOTEBOOK,
  },
  {
    value: 'DESKTOP',
    label: 'Desktop',
    slug: 'desktops',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.DESKTOP,
  },
  {
    value: 'MONITOR',
    label: 'Monitor',
    slug: 'monitores',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.MONITOR,
  },
  {
    value: 'IMPRESSORA',
    label: 'Impressora',
    slug: 'impressoras',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.IMPRESSORA,
  },
  {
    value: 'TPLINK',
    label: 'TP-Link',
    slug: 'tplink',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.TPLINK,
  },
  {
    value: 'OUTROS',
    label: 'Outros',
    slug: 'outros',
    featureKey: FEATURE_KEYS.EQUIPAMENTOS_TI.OUTROS,
  },
] as const

export type TiEquipmentCategory = (typeof TI_EQUIPMENT_CATEGORIES)[number]['value']

export const TI_EQUIPMENT_STATUSES = ['IN_STOCK', 'ASSIGNED', 'MAINTENANCE', 'RETIRED'] as const
export type TiEquipmentStatus = (typeof TI_EQUIPMENT_STATUSES)[number]

export function getTiEquipmentCategoryLabel(value: string) {
  return TI_EQUIPMENT_CATEGORIES.find((category) => category.value === value)?.label
}

export function getTiEquipmentCategoryByValue(value: string) {
  return TI_EQUIPMENT_CATEGORIES.find((category) => category.value === value) ?? null
}
