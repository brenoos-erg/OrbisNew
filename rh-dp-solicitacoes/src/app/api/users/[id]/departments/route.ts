export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { ensureUserDepartmentLink, removeUserDepartmentLink } from '@/lib/userDepartments'

type RouteParams = { params: { id: string } }

function normalizeDepartmentLabel(department: { code: string; name: string }) {
  return department.code ? `${department.code} - ${department.name}` : department.name
}

// Lista departamentos vinculados (inclui o principal)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: userId } = params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  const links = await prisma.userDepartment.findMany({
    where: { userId },
    include: {
      department: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const hasPrimary = user.departmentId
    ? links.some((l) => l.departmentId === user.departmentId)
    : false

  const items = links.map((link) => ({
    id: link.id,
    userId: link.userId,
    departmentId: link.departmentId,
    label: normalizeDepartmentLabel(link.department),
    department: link.department,
    isPrimary: user.departmentId === link.departmentId,
    canRemove: user.departmentId !== link.departmentId,
  }))

  // Caso o departamento principal não esteja na tabela de vínculos (dados antigos),
  // devolve também essa informação somente para exibição.
  if (user.departmentId && !hasPrimary) {
    const mainDept = await prisma.department.findUnique({
      where: { id: user.departmentId },
      select: { id: true, code: true, name: true },
    })

    if (mainDept) {
      items.unshift({
        id: `primary-${mainDept.id}`,
        userId,
        departmentId: mainDept.id,
        label: normalizeDepartmentLabel(mainDept),
        department: mainDept,
        isPrimary: true,
        canRemove: false,
      })
    }
  }

  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: userId } = params

  const body = await req.json().catch(() => ({}))
  const departmentId = body.departmentId as string | undefined
  const setAsPrimary = Boolean(body.setAsPrimary)

  if (!departmentId) {
    return NextResponse.json(
      { error: 'departmentId é obrigatório.' },
      { status: 400 },
    )
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  })
  if (!department) {
    return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await ensureUserDepartmentLink(userId, departmentId, tx)

    if (setAsPrimary) {
      await tx.user.update({
        where: { id: userId },
        data: { departmentId },
      })
    }
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id: userId } = params

  const url = new URL(req.url)
  const departmentId = url.searchParams.get('departmentId')

  if (!departmentId) {
    return NextResponse.json(
      { error: 'departmentId é obrigatório.' },
      { status: 400 },
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  if (user.departmentId === departmentId) {
    return NextResponse.json(
      { error: 'Esse departamento é o principal do usuário. Altere o principal antes de remover.' },
      { status: 400 },
    )
  }

  await removeUserDepartmentLink(userId, departmentId)

  return NextResponse.json({ ok: true })
}