// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validação do body do PATCH
const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Nome obrigatório').max(255),
  login: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  status: z.enum(['ATIVO', 'INATIVO']),
})

// ----------------------------------------------------
//  GET /api/users/[id]
//  Usado para carregar os dados na tela de perfil
// ----------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        login: true,
        phone: true,
        status: true,
        costCenters: {
          include: {
            costCenter: {
              select: { id: true, description: true },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 },
      )
    }

    // Formato que o UserProfilePageClient espera
    return NextResponse.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      login: user.login,
      phone: user.phone,
      status: user.status, // 'ATIVO' | 'INATIVO'
      costCenters: user.costCenters.map((link) => ({
        id: link.costCenter.id,
        description: link.costCenter.description,
      })),
    })
  } catch (err) {
    console.error('GET /api/users/[id] error', err)
    return NextResponse.json(
      { error: 'Erro interno ao buscar usuário.' },
      { status: 500 },
    )
  }
}

// ----------------------------------------------------
//  PATCH /api/users/[id]
//  Atualiza nome, login, telefone e status
// ----------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'JSON inválido.' },
      { status: 400 },
    )
  }

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Dados inválidos.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  const { fullName, login, phone, status } = parsed.data

  try {
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 },
      )
    }

    await prisma.user.update({
      where: { id },
      data: {
        fullName,
        login: login ?? null,
        phone: phone ?? null,
        status, // enum UserStatus (ATIVO / INATIVO)
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('PATCH /api/users/[id] error', err)

    // erro de unique (login duplicado, por exemplo)
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um usuário com este login ou e-mail.' },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { error: 'Erro ao salvar usuário.' },
      { status: 500 },
    )
  }
}
