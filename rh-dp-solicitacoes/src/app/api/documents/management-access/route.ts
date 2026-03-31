import { ModuleLevel } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { getUserModuleLevel } from '@/lib/access'

export async function GET() {
  const me = await requireActiveUser()
  const level = await getUserModuleLevel(me.id, MODULE_KEYS.CONTROLE_DOCUMENTOS)

  return NextResponse.json({ canManage: level === ModuleLevel.NIVEL_3 })
}