import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { bulkPreviewSchema, previewBulk } from '@/lib/tiEquipmentBulk'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { appUser, requestId } = await getCurrentAppUserFromRouteHandler()
  if (!appUser) return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  const canAccess = await canFeature(appUser.id, MODULE_KEYS.EQUIPAMENTOS_TI, 'equipamentos_ti_notebook', Action.CREATE)
  if (!canAccess) return NextResponse.json({ error: 'Sem permissão.', requestId }, { status: 403 })
  const parsed = bulkPreviewSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Payload inválido', issues: parsed.error.flatten() }, { status: 400 })
  const preview = await previewBulk(prisma, parsed.data)
  return NextResponse.json(preview)
}
