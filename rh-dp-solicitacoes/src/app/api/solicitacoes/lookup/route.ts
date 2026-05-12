export const dynamic = 'force-dynamic'
export const revalidate = 0

import { ModuleLevel } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { withModuleLevel } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { canViewSolicitation, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'

function normalizeProtocol(value: string | null) {
  return (value ?? '').replace(/\s+/g, '').toUpperCase()
}

export const GET = withModuleLevel(
  'solicitacoes',
  ModuleLevel.NIVEL_1,
  async (req: NextRequest, ctx) => {
    try {
      const { me } = ctx
      const { searchParams } = new URL(req.url)
      const protocolo = normalizeProtocol(searchParams.get('protocolo'))

      if (!protocolo) {
        return NextResponse.json({ error: 'Informe o protocolo.' }, { status: 400 })
      }

      const solicitation = await prisma.solicitation.findFirst({
        where: { protocolo },
        include: {
          tipo: { select: { id: true, codigo: true, nome: true } },
          assumidaPor: { select: { id: true, fullName: true } },
          department: { select: { name: true } },
          solicitacaoSetores: { select: { setor: true } },
        },
      })

      if (!solicitation) {
        return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
      }

      const userAccess = await resolveUserAccessContext({
        userId: me.id,
        userLogin: me.login,
        userEmail: me.email,
        userFullName: me.fullName,
        role: me.role,
        primaryDepartmentId: me.departmentId,
        primaryDepartment: me.department,
      })

      if (!canViewSolicitation(userAccess, solicitation)) {
        return NextResponse.json(
          { error: 'Você não possui permissão para visualizar/cancelar esta solicitação.' },
          { status: 403 },
        )
      }

      return NextResponse.json({
        solicitation: {
          id: solicitation.id,
          protocolo: solicitation.protocolo,
          titulo: solicitation.titulo,
          status: solicitation.status,
          assumidaPorId: solicitation.assumidaPorId,
          cancelamentoStatus: solicitation.cancelamentoStatus,
          tipo: solicitation.tipo,
          setorDestino: solicitation.department?.name ?? solicitation.solicitacaoSetores?.[0]?.setor ?? null,
          responsavel: solicitation.assumidaPor ? { fullName: solicitation.assumidaPor.fullName } : null,
        },
      })
    } catch (error) {
      console.error('GET /api/solicitacoes/lookup error', error)
      return NextResponse.json({ error: 'Erro ao localizar solicitação.' }, { status: 500 })
    }
  },
)
