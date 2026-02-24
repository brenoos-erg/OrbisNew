// src/app/dashboard/layout.tsx
import type { ReactNode } from 'react'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import UserMenu from '@/components/layout/userMenu'
import { userHasDepartmentOrCostCenter } from '@/lib/moduleAccess'
import { Action, ModuleLevel, Prisma } from '@prisma/client'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { SessionProvider } from '@/components/session/SessionProvider'

export const dynamic = 'force-dynamic'

const isDatabaseUnavailableError = (error: unknown) =>
  error instanceof Prisma.PrismaClientInitializationError ||
  error instanceof Prisma.PrismaClientKnownRequestError ||
  error instanceof Prisma.PrismaClientRustPanicError ||
  error instanceof Prisma.PrismaClientUnknownRequestError


export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const { appUser, dbUnavailable, session } = await getCurrentAppUser()
  const renderServiceUnavailable = (requestId?: string) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center text-slate-800">
      <p className="text-xl font-semibold">Serviço temporariamente indisponível</p>
      <p className="max-w-xl text-sm text-slate-600">
        Não foi possível acessar o banco de dados para carregar seus dados. Tente novamente em alguns minutos
        ou contate o suporte se o problema persistir.
      </p>
      {requestId ? (
        <p className="text-xs text-slate-500">ID da requisição: {requestId}</p>
      ) : null}
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

  const renderDashboardError = (requestId: string) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center text-slate-800">
      <p className="text-xl font-semibold">Não foi possível carregar o dashboard</p>
      <p className="max-w-xl text-sm text-slate-600">
        Ocorreu um erro inesperado ao preparar os seus dados. Tente novamente ou contate o suporte se o problema
        persistir.
      </p>
      <p className="text-xs text-slate-500">ID da requisição: {requestId}</p>
      <div className="flex items-center gap-3">
        <a
          href="/dashboard"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white"
        >
          Recarregar
        </a>
      </div>
    </div>
  )

  // se não tiver usuário logado, manda pro login
  if (!appUser) {
      if (dbUnavailable && session) {
      return renderServiceUnavailable()
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
  let showSst = false
  let showEquipments = false
  let canReviewRefusal = false
  let canAccessRefusalPanel = false
  let showMyDocuments = false
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
    fluxos: false,
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
  let myDocumentsFeatures = {
    listar: false,
    visualizar: false,
    assinar: false,
  }
  let equipmentFeatures = {
    atalho: false,
    linhaTelefonica: false,
    smartphone: false,
    notebook: false,
    desktop: false,
    monitor: false,
    impressora: false,
    tplink: false,
    outros: false,
  }

  if (appUser.id) {
     try {
      const levels = appUser.moduleLevels ?? {}
      const hasStructure = await userHasDepartmentOrCostCenter(
        appUser.id,
        appUser.costCenterId,
        appUser.departmentId,
      )

      const solicitLevel = levels[MODULE_KEYS.SOLICITACOES]
      const configLevel = levels[MODULE_KEYS.CONFIGURACOES]
      const fleetLevel = levels[MODULE_KEYS.FROTAS]
      const refusalLevel = levels[MODULE_KEYS.RECUSA]
      const equipmentLevel = levels[MODULE_KEYS.EQUIPAMENTOS_TI]
      const myDocumentsLevel = levels[MODULE_KEYS.MEUS_DOCUMENTOS]
      const sstLevel = levels[MODULE_KEYS.SST]

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
        canViewSolicFluxos,
        canViewFleetVeiculos,
        canViewFleetCheckins,
        canViewFleetDeslocamentoCheckin,
        canViewFleetDeslocamentoPainel,
        canViewRecusaPainel,
        canViewRecusaMinhas,
        canViewRecusaNova,
        canViewRecusaPendentes,
        canViewMyDocumentsListar,
        canViewMyDocumentsVisualizar,
        canSignMyDocuments,
        canViewEquipAtalho,
        canViewEquipLinhaTelefonica,
        canViewEquipSmartphone,
        canViewEquipNotebook,
        canViewEquipDesktop,
        canViewEquipMonitor,
        canViewEquipImpressora,
        canViewEquipTplink,
        canViewEquipOutros,
      ] = await Promise.all([
        canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PAINEL, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.PERMISSOES, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.CENTROS_DE_CUSTO, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.CARGOS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.ENVIADAS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.RECEBIDAS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.APROVACAO, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.CADASTROS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.FLUXOS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.VEICULOS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.CHECKINS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.DESLOCAMENTO_CHECKIN, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.FROTAS, FEATURE_KEYS.FROTAS.DESLOCAMENTO_PAINEL, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.PAINEL, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.MINHAS, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.NOVA, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.PENDENTES, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.MEUS_DOCUMENTOS, FEATURE_KEYS.MEUS_DOCUMENTOS.LISTAR, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.MEUS_DOCUMENTOS, FEATURE_KEYS.MEUS_DOCUMENTOS.VISUALIZAR, Action.VIEW),
        canFeature(appUser.id, MODULE_KEYS.MEUS_DOCUMENTOS, FEATURE_KEYS.MEUS_DOCUMENTOS.ASSINAR, Action.VIEW),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.ATALHO,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.LINHA_TELEFONICA,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.SMARTPHONE,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.NOTEBOOK,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.DESKTOP,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.MONITOR,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.IMPRESSORA,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.TPLINK,
          Action.VIEW,
        ),
        canFeature(
          appUser.id,
          MODULE_KEYS.EQUIPAMENTOS_TI,
          FEATURE_KEYS.EQUIPAMENTOS_TI.OUTROS,
          Action.VIEW,
        ),
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
        fluxos: canViewSolicFluxos,
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
       myDocumentsFeatures = {
        listar: canViewMyDocumentsListar,
        visualizar: canViewMyDocumentsVisualizar,
        assinar: canSignMyDocuments,
      }
      equipmentFeatures = {
        atalho: canViewEquipAtalho,
        linhaTelefonica: canViewEquipLinhaTelefonica,
        smartphone: canViewEquipSmartphone,
        notebook: canViewEquipNotebook,
        desktop: canViewEquipDesktop,
        monitor: canViewEquipMonitor,
        impressora: canViewEquipImpressora,
        tplink: canViewEquipTplink,
        outros: canViewEquipOutros,
      }

      showSolic =
        hasMinLevel(solicitLevel, ModuleLevel.NIVEL_1) &&
        hasStructure &&
        Object.values(solicitacaoFeatures).some(Boolean)
      showConfig = hasMinLevel(configLevel, ModuleLevel.NIVEL_1) && Object.values(configFeatures).some(Boolean)
      showFleet = hasMinLevel(fleetLevel, ModuleLevel.NIVEL_1) && Object.values(fleetFeatures).some(Boolean)
      showRefusal =
        hasMinLevel(refusalLevel, ModuleLevel.NIVEL_1) &&
        hasStructure &&
        Object.values(refusalFeatures).some(Boolean)
      showSst = hasMinLevel(sstLevel, ModuleLevel.NIVEL_1) && hasStructure
         showMyDocuments =
        hasMinLevel(myDocumentsLevel, ModuleLevel.NIVEL_1) &&
        hasStructure &&
        Object.values(myDocumentsFeatures).some(Boolean)
      showEquipments =
        hasMinLevel(equipmentLevel, ModuleLevel.NIVEL_1) && Object.values(equipmentFeatures).some(Boolean)
      canApprove =
        hasStructure &&
        (await canFeature(
          appUser.id,
          MODULE_KEYS.SOLICITACOES,
          FEATURE_KEYS.SOLICITACOES.APROVACAO,
          Action.APPROVE,
        ))
      canReviewRefusal =
        hasStructure &&
        (await canFeature(appUser.id, MODULE_KEYS.RECUSA, FEATURE_KEYS.RECUSA.PENDENTES, Action.APPROVE))
      canAccessRefusalPanel = refusalFeatures.painel
    } catch (error) {
      const requestId = crypto.randomUUID()
      console.error('Erro ao carregar dados do dashboard.', { requestId, error })

      if (isDatabaseUnavailableError(error)) {
        return renderServiceUnavailable(requestId)
      }

      return renderDashboardError(requestId)
    }
  }

  return (
    <SessionProvider>
      <div className="dashboard-shell min-h-screen flex">
        <Sidebar
          showSolic={showSolic}
          showConfig={showConfig}
          showFleet={showFleet}
          showRefusal={showRefusal}
          showSst={showSst}
          showEquipments={showEquipments}
          showMyDocuments={showMyDocuments}
          canApprove={canApprove}
          canReviewRefusal={canReviewRefusal}
          canAccessRefusalPanel={canAccessRefusalPanel}
          configFeatures={configFeatures}
          solicitacaoFeatures={solicitacaoFeatures}
          fleetFeatures={fleetFeatures}
          refusalFeatures={refusalFeatures}
          equipmentFeatures={equipmentFeatures}
          myDocumentsFeatures={myDocumentsFeatures}
          userMenu={<UserMenu collapsed={false} user={appUser} />}
        />

        {/* conteúdo */}
        <main className="flex-1 flex flex-col">
          <div className="h-16 border-b border-slate-200 flex items-center px-6 text-sm text-slate-600">
            Sistema de Gestão Integrada
          </div>
          <div className="p-6 flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </SessionProvider>
  )
}