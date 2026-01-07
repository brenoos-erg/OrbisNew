// src/app/dashboard/layout.tsx
import type { ReactNode } from 'react'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import UserMenu from '@/components/layout/userMenu'
import { userHasDepartmentOrCostCenter } from '@/lib/moduleAccess'
import { Action, ModuleLevel } from '@prisma/client'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature, getUserGroupIds } from '@/lib/permissions'
export const dynamic = 'force-dynamic'
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const { appUser, dbUnavailable, session } = await getCurrentAppUser()

  // se não tiver usuário logado, manda pro login
  if (!appUser) {
      if (dbUnavailable && session) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center text-slate-800">
          <p className="text-xl font-semibold">Serviço temporariamente indisponível</p>
          <p className="max-w-xl text-sm text-slate-600">
            Não foi possível acessar o banco de dados para carregar seus dados. Tente novamente em alguns minutos
            ou contate o suporte se o problema persistir.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="/login?logout=1"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-950"
            >
              Sair e tentar novamente
            </a>
            <a
              href="/dashboard"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white"
            >
              Recarregar
            </a>
          </div>
        </div>
      )
    }
    if (dbUnavailable) {
      const params = new URLSearchParams({ 'db-unavailable': '1', next: '/dashboard' })
      redirect(`/login?${params.toString()}`)
    }
    redirect('/login')
  }

  // se estiver inativo, mesma regra que já existia
  if (appUser.status === 'INATIVO') {
    redirect('/login?inactive=1')
  }

  const hasMinLevel = (level: ModuleLevel | undefined, min: ModuleLevel) => {
    const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
    const current = level ? order.indexOf(level) : -1
    return current >= order.indexOf(min)
  }

  // cálculo de módulos liberados com base na soma Departamento (NIVEL_1) + UserModuleAccess (sobrescrita)
  let showSolic = false
  let showConfig = false
  let canApprove = false
  let showFleet = false
  let showRefusal = false
  let canReviewRefusal = false
  let canAccessRefusalPanel = false
  let configFeatures = {
    painel: false,
    usuarios: false,
    permissoes: false,
    centros: false,
    cargos: false,
  }
  let solicitacaoFeatures = {
    enviadas: false,
    recebidas: false,
    aprovacao: false,
    cadastros: false,
  }
  let fleetFeatures = {
    veiculos: false,
    checkins: false,
    deslocamentoCheckin: false,
    deslocamentoPainel: false,
  }
  let refusalFeatures = {
    painel: false,
    minhas: false,
    nova: false,
    pendentes: false,
  }

  if (appUser.id) {
    const levels = appUser.moduleLevels ?? {}
    const hasStructure = await userHasDepartmentOrCostCenter(
      appUser.id,
      appUser.costCenterId,
      appUser.departmentId,
    )

    const solicitLevel = levels[MODULE_KEYS.SOLICITACOES]
    const configLevel = levels[MODULE_KEYS.CONFIGURACOES]
    const fleetLevel = levels[MODULE_KEYS.FROTAS] ?? levels['gestao_frotas']
    const refusalLevel = levels[MODULE_KEYS.RECUSA] ?? levels['direito_de_recusa']

    const userGroupIds = await getUserGroupIds(appUser.id)

    const [
      canViewConfigPainel,
      canViewConfigUsuarios,
      canViewConfigPermissoes,
      canViewConfigCentros,
      canViewConfigCargos,
      canViewSolicEnviadas,
      canViewSolicRecebidas,
      canViewSolicAprovacao,
      canViewSolicCadastros,
      canViewFleetVeiculos,
      canViewFleetCheckins,
      canViewFleetDeslocamentoCheckin,
      canViewFleetDeslocamentoPainel,
      canViewRecusaPainel,
      canViewRecusaMinhas,
      canViewRecusaNova,
      canViewRecusaPendentes,
    ] = await Promise.all([
      canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PAINEL, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.CENTROS_DE_CUSTO, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.CARGOS, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.ENVIADAS, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.RECEBIDAS, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.APROVACAO, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.CADASTROS, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.VEICULOS, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.CHECKINS, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.DESLOCAMENTO_CHECKIN, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.DESLOCAMENTO_PAINEL, Action.VIEW, {
        groupIds: userGroupIds,
      }),
      canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.PAINEL, Action.VIEW, { groupIds: userGroupIds }),
      canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.MINHAS, Action.VIEW, { groupIds: userGroupIds }),
      canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.NOVA, Action.VIEW, { groupIds: userGroupIds }),
      canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.PENDENTES, Action.VIEW, {
        groupIds: userGroupIds,
      }),
    ])

    configFeatures = {
      painel: canViewConfigPainel,
      usuarios: canViewConfigUsuarios,
      permissoes: canViewConfigPermissoes,
      centros: canViewConfigCentros,
      cargos: canViewConfigCargos,
    }

    solicitacaoFeatures = {
      enviadas: canViewSolicEnviadas,
      recebidas: canViewSolicRecebidas,
      aprovacao: canViewSolicAprovacao,
      cadastros: canViewSolicCadastros,
    }

    fleetFeatures = {
      veiculos: canViewFleetVeiculos,
      checkins: canViewFleetCheckins,
      deslocamentoCheckin: canViewFleetDeslocamentoCheckin,
      deslocamentoPainel: canViewFleetDeslocamentoPainel,
    }

    refusalFeatures = {
      painel: canViewRecusaPainel,
      minhas: canViewRecusaMinhas,
      nova: canViewRecusaNova,
      pendentes: canViewRecusaPendentes,
    }

    showSolic = hasMinLevel(solicitLevel, ModuleLevel.NIVEL_1) && hasStructure && Object.values(solicitacaoFeatures).some(Boolean)
    showConfig = hasMinLevel(configLevel, ModuleLevel.NIVEL_1) && Object.values(configFeatures).some(Boolean)
    showFleet = hasMinLevel(fleetLevel, ModuleLevel.NIVEL_1) && Object.values(fleetFeatures).some(Boolean)
    showRefusal = hasMinLevel(refusalLevel, ModuleLevel.NIVEL_1) && hasStructure && Object.values(refusalFeatures).some(Boolean)

    canApprove =
      hasStructure &&
      (await canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.APROVACAO, Action.APPROVE, {
        groupIds: userGroupIds,
      }))
    canReviewRefusal =
      hasStructure &&
      (await canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.PENDENTES, Action.APPROVE, {
        groupIds: userGroupIds,
      }))
    canAccessRefusalPanel = refusalFeatures.painel
  }

  return (
    <div className="dashboard-shell min-h-screen flex">
      <Sidebar
        showSolic={showSolic}
        showConfig={showConfig}
        showFleet={showFleet}
        showRefusal={showRefusal}
        canApprove={canApprove}
        canReviewRefusal={canReviewRefusal}
        canAccessRefusalPanel={canAccessRefusalPanel}
        configFeatures={configFeatures}
        solicitacaoFeatures={solicitacaoFeatures}
        fleetFeatures={fleetFeatures}
        refusalFeatures={refusalFeatures}
        userMenu={<UserMenu collapsed={false} user={appUser} />}
      />

      {/* conteúdo */}
      <main className="flex-1 flex flex-col">
        <div className="h-16 border-b border-slate-200 flex items-center px-6 text-sm text-slate-600">
          Sistema de Solicitações
        </div>
        <div className="p-6 flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  )
}