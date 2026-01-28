export const dynamic = 'force-dynamic'
export const revalidate = 0

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'


export async function GET(req: NextRequest) {
  try {
    await requireActiveUser()

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('departmentId')?.trim()
    const costCenterId = searchParams.get('costCenterId')?.trim()

    if (!departmentId) {
      return NextResponse.json(
        { error: 'departmentId é obrigatório' },
        { status: 400 },
      )
    }

    // Aqui você pode manter os filtros que já tinha (por CC, depto, etc.)
    const solicitacoes = await prisma.solicitation.findMany({
      where: {
        departmentId,
        ...(costCenterId ? { costCenterId } : {}),
      },
      include: {
        costCenter: true,
        solicitante: true,
        approver: true,    // quem aprovou
        assumidaPor: true, // 👈 QUEM ESTÁ ATENDENDO
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

  const items = solicitacoes.map((s) => ({
      id: s.id,
      protocolo: s.protocolo,
      status: s.status,
      createdAt: s.dataAbertura,
      titulo: s.titulo,
      solicitanteNome:
        s.solicitante.fullName || s.solicitante.email || '—',
      centroCustoNome: s.costCenter?.description ?? '—',
      // ✅ ATENDENTE: SOMENTE quem assumiu
      atendenteNome: s.assumidaPor
        ? s.assumidaPor.fullName || s.assumidaPor.email
        : null,
      // Se quiser mostrar quem aprovou em outro lugar:
      aprovadorNome: s.approver
        ? s.approver.fullName || s.approver.email
        : null,
    }))

    return NextResponse.json(items)
  } catch (err) {
    console.error('GET /api/solicitacoes/recebidas error', err)
    return NextResponse.json(
      { error: 'Erro ao buscar solicitações recebidas.' },
      { status: 500 },
    )
  }
}
