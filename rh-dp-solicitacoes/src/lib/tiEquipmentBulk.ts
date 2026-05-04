import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { TI_EQUIPMENT_CATEGORIES, TI_EQUIPMENT_STATUSES, type TiEquipmentCategory, type TiEquipmentStatus } from '@/lib/tiEquipment'

const categoryValues = TI_EQUIPMENT_CATEGORIES.map((c) => c.value)

export const bulkCommonSchema = z.object({
  costCenterId: z.string().min(1),
  department: z.string().optional().nullable(),
  category: z.enum(categoryValues as [TiEquipmentCategory, ...TiEquipmentCategory[]]),
  status: z.enum(TI_EQUIPMENT_STATUSES).default('IN_STOCK'),
  local: z.string().optional().nullable(),
  defaultResponsibleId: z.string().optional().nullable(),
  acquiredAt: z.string().optional().nullable(),
  deliveredAt: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  source: z.enum(['MANUAL','PASTE','UPLOAD']).default('MANUAL'),
})

export const bulkRowSchema = z.object({
  lineNumber: z.number().int().positive(),
  patrimonio: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  hostname: z.string().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  responsibleEmail: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  local: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
})

export const bulkPreviewSchema = z.object({ common: bulkCommonSchema, rows: z.array(bulkRowSchema).min(1) })
export const bulkCommitSchema = bulkPreviewSchema.extend({ importValidOnly: z.boolean().default(true) })

const statusMap: Record<string, TiEquipmentStatus> = {
  EM_ESTOQUE: 'IN_STOCK', IN_STOCK: 'IN_STOCK', ESTOQUE: 'IN_STOCK',
  ATRIBUIDO: 'ASSIGNED', ASSIGNED: 'ASSIGNED', EM_USO: 'ASSIGNED',
  MANUTENCAO: 'MAINTENANCE', MAINTENANCE: 'MAINTENANCE',
  BAIXADO: 'RETIRED', RETIRED: 'RETIRED',
}

export function normalizeStatus(input: string | null | undefined, fallback: TiEquipmentStatus): TiEquipmentStatus | null {
  if (!input) return fallback
  const key = input.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim().replace(/\s+/g, '_')
  return statusMap[key] ?? null
}

export async function previewBulk(prisma: Prisma.TransactionClient | any, payload: z.infer<typeof bulkPreviewSchema>) {
  const patrimonios = new Set<string>()
  const serials = new Set<string>()
  const duplicatesPat = new Set<string>()
  const duplicatesSer = new Set<string>()
  for (const r of payload.rows) {
    const p = r.patrimonio?.trim()
    const s = r.serialNumber?.trim()
    if (p) (patrimonios.has(p) ? duplicatesPat.add(p) : patrimonios.add(p))
    if (s) (serials.has(s) ? duplicatesSer.add(s) : serials.add(s))
  }

  const [existsPat, existsSer, validCenter, users] = await Promise.all([
    prisma.tiEquipment.findMany({ where: { patrimonio: { in: [...patrimonios] } }, select: { patrimonio: true } }),
    prisma.tiEquipment.findMany({ where: { serialNumber: { in: [...serials] } }, select: { serialNumber: true } }),
    prisma.costCenter.findUnique({ where: { id: payload.common.costCenterId }, select: { id: true } }),
    prisma.user.findMany({ where: { OR: payload.rows.flatMap((r:any)=> [r.responsibleId?{id:r.responsibleId}:null,r.responsibleEmail?{email:r.responsibleEmail}:null]).filter(Boolean) }, select: { id: true, email: true } }),
  ])

  const userIdSet = new Set(users.map((u:any)=>u.id))
  const userEmailSet = new Set(users.map((u:any)=>u.email))
  const patExistSet = new Set(existsPat.map((e:any)=>e.patrimonio))
  const serExistSet = new Set(existsSer.map((e:any)=>e.serialNumber).filter(Boolean))

  const rows = payload.rows.map((r) => {
    const errors: string[] = []
    const warnings: string[] = []
    const patrimonio = r.patrimonio?.trim() || ''
    const serialNumber = r.serialNumber?.trim() || null
    if (!validCenter) errors.push('Centro de custo obrigatório/inválido.')
    if (!patrimonio) errors.push('Patrimônio obrigatório.')
    if (duplicatesPat.has(patrimonio)) errors.push('Patrimônio duplicado na grade.')
    if (patExistSet.has(patrimonio)) errors.push('Patrimônio já existente no banco.')
    if (serialNumber && duplicatesSer.has(serialNumber)) errors.push('Serial duplicado na grade.')
    if (serialNumber && serExistSet.has(serialNumber)) errors.push('Serial já existente no banco.')
    const normalizedStatus = normalizeStatus(r.status, payload.common.status)
    if (!normalizedStatus) errors.push('Status inválido.')
    if (r.responsibleId && !userIdSet.has(r.responsibleId)) warnings.push('Responsável não encontrado por ID.')
    if (r.responsibleEmail && !userEmailSet.has(r.responsibleEmail)) warnings.push('Responsável não encontrado por e-mail.')
    const isValid = errors.length === 0
    return { ...r, patrimonio, serialNumber, normalizedStatus, errors, warnings, statusTag: isValid ? (warnings.length ? 'ATENCAO':'VALIDO') : 'ERRO', isValid }
  })
  const summary = { total: rows.length, valid: rows.filter((r)=>r.isValid).length, withError: rows.filter((r)=>!r.isValid).length, warnings: rows.reduce((a,r)=>a+r.warnings.length,0) }
  return { rows, summary }
}
