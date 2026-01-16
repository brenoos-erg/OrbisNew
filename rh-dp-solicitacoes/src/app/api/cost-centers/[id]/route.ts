export const dynamic = 'force-dynamic'
export const revalidate = 0

// src/app/api/configuracoes/centros-de-custo/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


// PATCH: edita
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const {
    description,
    code,
    externalCode,
    abbreviation,
    area,
    managementType,
    groupName,
    status,   // 'ATIVADO' | 'INATIVO' (front)
    notes,    // mapeado para observations
  } = body || {}

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
  }

  const updated = await prisma.costCenter.update({
    where: { id: params.id },
    data: {
      description: description.trim(),
      code: code?.trim() ?? null,
      externalCode: externalCode?.trim() ?? null,
      abbreviation: abbreviation?.trim() ?? null,
      area: area?.trim() ?? null,
      managementType: managementType?.trim() ?? null,
      groupName: groupName?.trim() ?? null,
      status: status === 'INATIVO' ? 'INACTIVE' : 'ACTIVE', // enum correto
      observations: notes?.trim() ?? null,                  // campo correto
    },
    select: { id: true, description: true },
  })

  return NextResponse.json({ ok: true, row: updated })
}

// DELETE: apaga
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.costCenter.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
