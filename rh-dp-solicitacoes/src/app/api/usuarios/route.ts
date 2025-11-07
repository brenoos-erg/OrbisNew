import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: lista os últimos usuários
export async function GET() {
  try {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, fullName: true, email: true, login: true,
        phone: true, costCenter: true, createdAt: true,
      },
    })
    return NextResponse.json({ rows })
  } catch (e) {
    console.error('GET /api/usuarios error', e)
    return NextResponse.json({ rows: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { fullName, email, login, phone, costCenter } = body as {
      fullName?: string; email?: string; login?: string;
      phone?: string | null; costCenter?: string | null
    }

    if (!fullName || !email || !login) {
      return NextResponse.json({ error: 'Nome, e-mail e login são obrigatórios.' }, { status: 400 })
    }

    // Se seu modelo tiver 'status' sem default ou 'updatedAt' sem @updatedAt,
    // estes campos abaixo evitam o erro 23502 (not-null). Se seu modelo NÃO
    // tiver esses campos, pode remover sem problemas.
    const created = await prisma.user.create({
      data: {
        fullName,
        email,
        login,
        phone: phone || null,
        costCenter: costCenter || null,
        // Descomente se o seu modelo tiver esses campos como NOT NULL:
        // status: 'ACTIVE' as any,
        // createdAt: new Date(),
        // updatedAt: new Date(),
      },
      select: { id: true, fullName: true, email: true, login: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    // Mostra códigos Prisma/PG para sabermos a causa
    console.error('POST /api/usuarios error', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email ou login já cadastrado.' }, { status: 409 })
    }
    // Quando o erro vem do Postgres (ex.: NOT NULL ou enum), pegue o detalhe:
    const message = e?.meta?.cause || e?.message || 'Erro ao criar usuário.'
    return NextResponse.json({ error: message, code: e?.code }, { status: 500 })
  }
}
