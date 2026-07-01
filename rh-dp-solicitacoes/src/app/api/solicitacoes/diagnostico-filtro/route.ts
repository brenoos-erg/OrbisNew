export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { formatCostCenterLabel } from '@/lib/costCenter'
import { buildReceivedWhereByPolicy, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import { buildBaseWhereFromFilters, parseSolicitationListFilters } from '@/lib/solicitationListFilters'

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { searchParams } = new URL(req.url)
    const protocol = searchParams.get('protocol') ?? searchParams.get('protocolo') ?? searchParams.get('q') ?? ''
    const normalizedProtocol = protocol.trim()
    const filters = parseSolicitationListFilters(searchParams)

    if (!normalizedProtocol) {
      return NextResponse.json({ found: false, visibleToUser: false, appearsInCurrentScope: false, reasonCode: 'NOT_FOUND', message: 'Informe um protocolo para diagnóstico.' }, { status: 400 })
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

    const solicitation = await prisma.solicitation.findUnique({
      where: { protocolo: normalizedProtocol },
      include: {
        tipo: { select: { id: true, codigo: true, nome: true } },
        department: { select: { id: true, name: true, sigla: true, code: true } },
        costCenter: { select: { id: true, description: true, externalCode: true, code: true, abbreviation: true } },
        assumidaPor: { select: { id: true, fullName: true, login: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ found: false, visibleToUser: false, appearsInCurrentScope: false, reasonCode: 'NOT_FOUND', message: 'Este protocolo não foi encontrado.' })
    }

    const visibleWhere = buildReceivedWhereByPolicy(userAccess, { id: solicitation.id }, { excludePendingRq063: true })
    const visible = await prisma.solicitation.findFirst({ where: visibleWhere, select: { id: true } })
    if (!visible) {
      return NextResponse.json({ found: true, visibleToUser: false, appearsInCurrentScope: false, reasonCode: 'NO_PERMISSION', message: 'Este protocolo existe, mas seu usuário não possui permissão para visualizá-lo neste escopo.' })
    }

    const scopedWhere = buildReceivedWhereByPolicy(userAccess, { AND: [{ id: solicitation.id }, buildBaseWhereFromFilters(filters)] }, { excludePendingRq063: true })
    const appears = await prisma.solicitation.findFirst({ where: scopedWhere, select: { id: true } })
    let reasonCode = 'OUTSIDE_SCOPE'
    if (filters.status && filters.status !== solicitation.status) reasonCode = 'FILTERED_BY_STATUS'
    if (filters.tipoId && filters.tipoId !== solicitation.tipoId) reasonCode = 'FILTERED_BY_TYPE'

    return NextResponse.json({
      found: true,
      visibleToUser: true,
      appearsInCurrentScope: Boolean(appears),
      reasonCode: appears ? 'APPEARS' : reasonCode,
      message: appears
        ? 'Este protocolo aparece com os filtros atuais.'
        : 'Este protocolo existe, mas não aparece na lista atual por escopo ou filtros aplicados.',
      currentStatus: solicitation.status,
      currentDepartment: solicitation.department?.name ?? null,
      currentCostCenter: formatCostCenterLabel(solicitation.costCenter, '') || null,
      currentAssignee: solicitation.assumidaPor?.fullName ?? null,
      suggestedUrl: `/dashboard/solicitacoes/${solicitation.id}`,
    })
  } catch (err) {
    console.error('GET /api/solicitacoes/diagnostico-filtro error', err)
    if (err instanceof Error && err.message === 'Usuário não autenticado') return NextResponse.json({ error: err.message }, { status: 401 })
    if (err instanceof Error && err.message === 'Usuário inativo') return NextResponse.json({ error: err.message }, { status: 403 })
    return NextResponse.json({ error: 'Erro ao diagnosticar protocolo.' }, { status: 500 })
  }
}
