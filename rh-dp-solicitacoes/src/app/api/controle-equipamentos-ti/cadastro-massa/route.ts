import { NextResponse } from 'next/server'
import { Action, Prisma } from '@prisma/client'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { bulkCommitSchema, previewBulk } from '@/lib/tiEquipmentBulk'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { appUser, requestId } = await getCurrentAppUserFromRouteHandler()
  if (!appUser) return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  const canAccess = await canFeature(appUser.id, MODULE_KEYS.EQUIPAMENTOS_TI, 'equipamentos_ti_notebook', Action.CREATE)
  if (!canAccess) return NextResponse.json({ error: 'Sem permissão.', requestId }, { status: 403 })
  const parsed = bulkCommitSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.flatten() }, { status: 400 })

  const preview = await previewBulk(prisma, parsed.data)
  const toCreate = preview.rows.filter((r:any)=> parsed.data.importValidOnly ? r.isValid : true)
  const created: any[] = []
  const ignored: any[] = []
  await prisma.$transaction(async (tx) => {
    for (const row of toCreate) {
      if (!row.isValid) { ignored.push(row); continue }
      const resolvedUserId = row.responsibleId ?? parsed.data.common.defaultResponsibleId
      if (!resolvedUserId) { ignored.push({ ...row, errors: ['Responsável obrigatório.'] }); continue }
      try {
        const item = await tx.tiEquipment.create({ data: {
          name: [row.brand, row.model, row.hostname].filter(Boolean).join(' ').trim() || `Equipamento ${row.patrimonio}`,
          patrimonio: row.patrimonio,
          userId: resolvedUserId,
          serialNumber: row.serialNumber,
          category: parsed.data.common.category,
          status: row.normalizedStatus ?? undefined,
          observations: [parsed.data.common.observations,row.observations].filter(Boolean).join(' | ') || null,
          costCenterIdSnapshot: parsed.data.common.costCenterId,
          value: null,
        } })
        created.push(item)
      } catch (e:any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') ignored.push({ ...row, errors: ['Já existente no banco.'] })
        else throw e
      }
    }
  })

  return NextResponse.json({
    total: preview.rows.length,
    cadastrados: created.length,
    ignorados: ignored.length,
    comErro: preview.rows.filter((r:any)=>!r.isValid).length,
    jaExistentes: ignored.length,
    linhas: preview.rows,
  })
}
