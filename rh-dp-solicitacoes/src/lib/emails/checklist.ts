export type VehicleChecklistEmailArgs = {
  inspectionDate: string
  inspectionTime?: string
  driverName: string
  vehiclePlate: string
  vehicleType: string
  vehicleKm: number
  itemsWithProblem: Array<{ name?: string; label?: string }>
  driverStatus: 'APTO' | 'INAPTO'
  fatigueRisk: 'LEVE' | 'TOLERAVEL' | 'GRAVE'
  nonConformityCriticality?: string | null
  nonConformityActions?: string | null
  nonConformityManager?: string | null
  nonConformityHandlingDate?: string | null
}

type VehicleChecklistEmailContent = {
  subject: string
  text: string
}

function formatItemsWithProblem(items: Array<{ name?: string; label?: string }>): string {
  if (!items.length) {
    return 'Nenhum item com problema reportado.'
  }

  return items
    .map(({ label, name }, index) => `${index + 1}. ${label ?? name ?? 'Item não especificado'}`)
    .join('\n')
}

function formatOptionalField(label: string, value?: string | null): string | null {
  if (!value) return null
  return `${label}: ${value}`
}

export function buildVehicleChecklistEmailContent({
  inspectionDate,
  inspectionTime,
  driverName,
  vehiclePlate,
  vehicleType,
  vehicleKm,
  itemsWithProblem,
  driverStatus,
  fatigueRisk,
  nonConformityActions,
  nonConformityCriticality,
  nonConformityManager,
  nonConformityHandlingDate,
}: VehicleChecklistEmailArgs): VehicleChecklistEmailContent {
  const scheduledAt = inspectionTime
    ? `${inspectionDate} às ${inspectionTime}`
    : inspectionDate

  const nonConformityDetails = [
    formatOptionalField('Criticidade', nonConformityCriticality),
    formatOptionalField('Ações tomadas', nonConformityActions),
    formatOptionalField('Gestor responsável', nonConformityManager),
    formatOptionalField('Data de tratativa', nonConformityHandlingDate),
  ]
    .filter(Boolean)
    .join('\n')

  const subject = `Checklist de veículo (${vehiclePlate}) - ${driverStatus}`

  const textSections = [
    `Data da inspeção: ${scheduledAt}`,
    `Motorista: ${driverName}`,
    `Veículo: ${vehicleType} (${vehiclePlate})`,
    `Quilometragem: ${vehicleKm} km`,
    `Status do motorista: ${driverStatus}`,
    `Risco de fadiga: ${fatigueRisk}`,
    '',
    'Itens com problema:',
    formatItemsWithProblem(itemsWithProblem),
  ]

  if (nonConformityDetails) {
    textSections.push('', 'Não conformidade:', nonConformityDetails)
  }

  return {
    subject,
    text: textSections.join('\n'),
  }
}