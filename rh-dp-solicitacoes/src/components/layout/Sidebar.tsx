'use client'
// src/components/layout/Sidebar.tsx
import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  ChevronLeft,
  Send,
  Inbox,
  FolderCog,
  Settings,
  Users,
  Shield,
  Truck,
  ClipboardCheck,
  ShieldAlert,
  Route,
  LayoutDashboard,
  Laptop,
  Monitor,
  Smartphone,
  Printer,
  Phone,
  Router,
  Cpu,
  Package,
  ScanLine,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { handleFleetUnauthorized } from '@/lib/fleet-auth'

type Props = {
  showSolic: boolean
  showConfig: boolean
  showFleet: boolean
  showRefusal: boolean
  showEquipments: boolean
  canApprove: boolean
  canReviewRefusal: boolean
  canAccessRefusalPanel?: boolean
  configFeatures: {
    painel: boolean
    usuarios: boolean
    permissoes: boolean
    centros: boolean
    cargos: boolean
  }
  solicitacaoFeatures: {
    enviadas: boolean
    recebidas: boolean
    aprovacao: boolean
    cadastros: boolean
  }
  fleetFeatures: {
    veiculos: boolean
    checkins: boolean
    deslocamentoCheckin: boolean
    deslocamentoPainel: boolean
  }
  refusalFeatures: {
    painel: boolean
    minhas: boolean
    nova: boolean
    pendentes: boolean
  }
  equipmentFeatures: {
    atalho: boolean
    linhaTelefonica: boolean
    smartphone: boolean
    notebook: boolean
    desktop: boolean
    monitor: boolean
    impressora: boolean
    tplink: boolean
    outros: boolean
  }
  userMenu: ReactNode
}
export default function Sidebar({
  showSolic,
  showConfig,
  showFleet,
  showRefusal,
  showEquipments,
  canApprove,
  canReviewRefusal,
  canAccessRefusalPanel = false,
  configFeatures,
  solicitacaoFeatures,
  fleetFeatures,
  refusalFeatures,
  equipmentFeatures,
  userMenu,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [restrictedVehicleCount, setRestrictedVehicleCount] = useState<number | null>(null)
  const [receivedSolicitationsCount, setReceivedSolicitationsCount] = useState<number | null>(null)
  const [pendingRefusalCount, setPendingRefusalCount] = useState<number | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)


  const pathname = usePathname()
  const inSolic = pathname.startsWith('/dashboard/solicitacoes')
  const inConfig = pathname.startsWith('/dashboard/configuracoes')
  const inFleet = pathname.startsWith('/dashboard/gestao-de-frotas')
  const inRefusal = pathname.startsWith('/dashboard/direito-de-recusa')
  const inEquipment = pathname.startsWith('/dashboard/controle-equipamentos-ti')

  const [openSolic, setOpenSolic] = useState(inSolic)
  const [openConfig, setOpenConfig] = useState(inConfig)
  const [openFleet, setOpenFleet] = useState(inFleet)
  const [openRefusal, setOpenRefusal] = useState(inRefusal)
  const [openEquipment, setOpenEquipment] = useState(inEquipment)

  // quando mudar de rota, abre o grupo correspondente e fecha o outro
  useEffect(() => {
    if (inSolic) {
      setOpenSolic(true)
      setOpenConfig(false)
      setOpenFleet(false)
      setOpenRefusal(false)
      setOpenEquipment(false)
    } else if (inConfig) {
      setOpenConfig(true)
      setOpenSolic(false)
      setOpenFleet(false)
      setOpenRefusal(false)
      setOpenEquipment(false)
    } else if (inFleet) {
      setOpenFleet(true)
      setOpenSolic(false)
      setOpenConfig(false)
      setOpenRefusal(false)
      setOpenEquipment(false)
    } else if (inRefusal) {
      setOpenRefusal(true)
      setOpenFleet(false)
      setOpenSolic(false)
      setOpenConfig(false)
      setOpenEquipment(false)
    } else if (inEquipment) {
      setOpenEquipment(true)
      setOpenRefusal(false)
      setOpenFleet(false)
      setOpenSolic(false)
      setOpenConfig(false)
    }
  }, [inSolic, inConfig, inFleet, inRefusal, inEquipment])

  // Lembra estado entre reloads
  useEffect(() => {
    const v = localStorage.getItem('sidebar_collapsed')
    if (v === '1') setCollapsed(true)
  }, [])
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0')
  }, [collapsed])
  useEffect(() => {
    if (!showFleet || !fleetFeatures.veiculos) return

    let active = true
    const controller = new AbortController()
    const loadRestrictedVehicles = async () => {
      try {
        const response = await fetch('/api/fleet/vehicles?status=RESTRITO', {
          signal: controller.signal,
        })
        if (handleFleetUnauthorized(response)) return
        if (!response.ok) return
        const data = await response.json()
        if (active && Array.isArray(data)) {
          setRestrictedVehicleCount(data.length)
        }
      } catch {
        // ignore
      }
    }

    loadRestrictedVehicles()

    return () => {
      active = false
      controller.abort()
    }
  }, [fleetFeatures.veiculos, showFleet])

  useEffect(() => {
    if (!showSolic || !solicitacaoFeatures.recebidas) return

    let active = true
    const controller = new AbortController()
    const loadDepartment = async () => {
      try {
        const response = await fetch('/api/me', {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = await response.json()
        if (active) {
          setDepartmentId(data?.departmentId ?? null)
        }
      } catch {
        // ignore
      }
    }

    loadDepartment()

    return () => {
      active = false
      controller.abort()
    }
  }, [showSolic, solicitacaoFeatures.recebidas])

  useEffect(() => {
    if (!showSolic || !solicitacaoFeatures.recebidas) return
    if (!departmentId) return

    let active = true
    const controller = new AbortController()
    const loadReceivedSolicitations = async () => {
      try {
        const response = await fetch(
          `/api/solicitacoes/recebidas?departmentId=${encodeURIComponent(
            departmentId,
          )}`,
          {
            signal: controller.signal,
          },
        )
        if (!response.ok) return
        const data = await response.json()
        if (active && Array.isArray(data)) {
          setReceivedSolicitationsCount(data.length)
        }
      } catch {
        // ignore
      }
    }

    loadReceivedSolicitations()

    return () => {
      active = false
      controller.abort()
    }
  }, [showSolic, solicitacaoFeatures.recebidas, departmentId])

  useEffect(() => {
    if (!showRefusal || !canReviewRefusal || !refusalFeatures.pendentes) return

    let active = true
    const controller = new AbortController()
    const loadPendingRefusals = async () => {
      try {
        const response = await fetch('/api/direito-de-recusa?status=PENDENTE', {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = await response.json()
        if (active && Array.isArray(data?.reports)) {
          setPendingRefusalCount(data.reports.length)
        }
      } catch {
        // ignore
      }
    }

    loadPendingRefusals()

   return () => {
      active = false
      controller.abort()
    }
  }, [showRefusal, canReviewRefusal, refusalFeatures.pendentes])
  const baseSection =
     'w-full flex items-center gap-1 px-3 py-2.5 text-sm font-semibold rounded-md transition-colors cursor-pointer'
  const activeSection = 'bg-orange-500 text-white shadow-sm'
  const inactiveSection = 'text-slate-200 hover:bg-white/10'
  const submenuItemBase =
    'group flex items-center gap-1 rounded-md text-sm font-medium px-4 py-2.5 transition-colors'
  const badgeBase =
    'ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold'
  const iconBadgeBase =
    'absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white'
    const labelBase = 'flex-1 -ml-0.5'
  return (
    <aside
      className={`min-h-screen bg-[#0f172a] text-slate-200 shadow-xl flex flex-col justify-between transition-all duration-200
        ${collapsed ? 'w-16' : 'w-72'}`}
    >
      <div>
        {/* Cabeçalho com botão recolher/expandir */}
        <div className="h-16 flex items-center px-3 border-b border-white/10">
          {!collapsed && (
            <div className="font-semibold mr-2">Sistema de Gestão Integrada</div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="ml-auto rounded-md p-2 hover:bg-white/10"
          >
            <ChevronLeft
              size={18}
              className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* MENU */}
        <nav className="px-3 space-y-2 mt-2">
          {showFleet && (
            <div>
              <button
                type="button"
                onClick={() => setOpenFleet((v) => !v)}
                className={`${baseSection} ${
                  inFleet ? activeSection : inactiveSection
                }`}
              >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
                  <Truck className="h-5 w-5 shrink-0" />
                  {restrictedVehicleCount !== null && restrictedVehicleCount > 0 && (
                    <span className={iconBadgeBase}>{restrictedVehicleCount}</span>
                  )}
                </span>
                  {!collapsed && <span className={labelBase}>Gestão de Frotas</span>}
              </button>

              {openFleet && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                    {fleetFeatures.veiculos && (
                    <Link
                      href="/dashboard/gestao-de-frotas/veiculos"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/veiculos')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Truck size={16} />
                      <span className={labelBase}>Veículos</span>
                      {!collapsed && restrictedVehicleCount !== null && restrictedVehicleCount > 0 && (
                        <span className={`${badgeBase} bg-red-500 text-white`}>
                          {restrictedVehicleCount}
                        </span>
                      )}
                    </Link>
                  )}

                  {fleetFeatures.checkins && (
                    <Link
                      href="/dashboard/gestao-de-frotas/checkins"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/checkins')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                         <ClipboardCheck size={16} /> <span className={labelBase}>Check-ins diários</span>
                    </Link>
                  )}
                  {fleetFeatures.deslocamentoCheckin && (
                    <Link
                      href="/dashboard/gestao-de-frotas/deslocamento/checkin"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/deslocamento/checkin')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Route size={16} /> <span className={labelBase}>Check-in de deslocamento</span>
                   </Link>
                  )}
                  {fleetFeatures.deslocamentoPainel && (
                    <Link
                      href="/dashboard/gestao-de-frotas/deslocamento/painel"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/deslocamento/painel')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <LayoutDashboard size={16} /> <span className={labelBase}>Painel deslocamentos</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
            )}
          {showEquipments && (
            <div>
              <button
                type="button"
                onClick={() => setOpenEquipment((v) => !v)}
                className={`${baseSection} ${
                  inEquipment ? activeSection : inactiveSection
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
                  <Package className="h-5 w-5 shrink-0" />
                </span>
                 {!collapsed && <span className={labelBase}>Controle de Equipamentos TI</span>}
              </button>

              {openEquipment && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                   {equipmentFeatures.atalho && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/atalho"
                       className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/atalho')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <ScanLine size={16} /> <span className={labelBase}>Atalho rápido</span>
                    </Link>
                  )}
                  {equipmentFeatures.linhaTelefonica && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/linha-telefonica"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/linha-telefonica')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Phone size={16} /> <span className={labelBase}>Linhas telefônicas</span>
                    </Link>
                  )}
                  {equipmentFeatures.smartphone && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/smartphones"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/smartphones')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                       <Smartphone size={16} /> <span className={labelBase}>Smartphones</span>
                    </Link>
                  )}
                  {equipmentFeatures.notebook && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/notebooks"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/notebooks')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Laptop size={16} /> <span className={labelBase}>Notebooks</span>
                    </Link>
                  )}
                  {equipmentFeatures.desktop && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/desktops"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/desktops')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Cpu size={16} /> <span className={labelBase}>Desktops</span>
                    </Link>
                  )}
                  {equipmentFeatures.monitor && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/monitores"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/monitores')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                         <Monitor size={16} /> <span className={labelBase}>Monitores</span>
                    </Link>
                  )}
                  {equipmentFeatures.impressora && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/impressoras"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/impressoras')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Printer size={16} /> <span className={labelBase}>Impressoras</span>
                    </Link>
                  )}
                  {equipmentFeatures.tplink && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/tplink"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/tplink')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Router size={16} /> <span className={labelBase}>TP-Link</span>
                    </Link>
                  )}
                  {equipmentFeatures.outros && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/outros"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/outros')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                        <Package size={16} /> <span className={labelBase}>Outros equipamentos</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
            {showRefusal && (
            <div>
              <button
                type="button"
                onClick={() => setOpenRefusal((v) => !v)}
                className={`${baseSection} ${
                  inRefusal ? activeSection : inactiveSection
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                </span>
                {!collapsed && <span className={labelBase}>Direito de Recusa</span>}
                {!collapsed && pendingRefusalCount !== null && pendingRefusalCount > 0 && (
                  <span className={`${badgeBase} bg-yellow-400 text-slate-900`}>
                    {pendingRefusalCount}
                  </span>
                )}
              </button>

              {openRefusal && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  {canAccessRefusalPanel && refusalFeatures.painel && (
                    <Link
                      href="/dashboard/direito-de-recusa"
                      className={`${submenuItemBase}
                        ${
                          pathname === '/dashboard/direito-de-recusa'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                      >
                       <ShieldAlert size={16} /> <span className={labelBase}>Painel</span>
                    </Link>
                  )}
                   {refusalFeatures.minhas && (
                    <Link
                      href="/dashboard/direito-de-recusa/minhas"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/direito-de-recusa/minhas')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <ClipboardList size={16} /> <span className={labelBase}>Meus direitos de recusa</span>
                    </Link>
                  )}
                  {refusalFeatures.nova && (
                    <Link
                      href="/dashboard/direito-de-recusa/nova"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/direito-de-recusa/nova')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <ClipboardList size={16} /> <span className={labelBase}>Registrar recusa</span>
                    </Link>
                  )}
                  {canReviewRefusal && refusalFeatures.pendentes && (
                    <Link
                      href="/dashboard/direito-de-recusa/pendentes"
                      className={`${submenuItemBase}
                        ${
                          pathname === '/dashboard/direito-de-recusa/pendentes'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                       <CheckCircle2 size={16} />
                      <span className={labelBase}>Pendentes para avaliar</span>
                      {!collapsed && pendingRefusalCount !== null && pendingRefusalCount > 0 && (
                        <span className={`${badgeBase} bg-yellow-400 text-slate-900`}>
                          {pendingRefusalCount}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {showSolic && (
            <div>
              {/* Cabeçalho do grupo Solicitações */}
              <button
                type="button"
                onClick={() => setOpenSolic((v) => !v)}
                className={`${baseSection} ${
                  inSolic ? activeSection : inactiveSection
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
                  <ClipboardList className="h-5 w-5 shrink-0" />
                </span>
                {!collapsed && <span className={labelBase}>Solicitações</span>}
                {!collapsed && receivedSolicitationsCount !== null && receivedSolicitationsCount > 0 && (
                  <span className={`${badgeBase} bg-sky-500 text-white`}>
                    {receivedSolicitationsCount}
                  </span>
                )}
              </button>

              {/* Submenu – só aparece se não estiver colapsado e se estiver "openSolic" */}
              {openSolic && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  {solicitacaoFeatures.enviadas && (
                    <Link
                      href="/dashboard/solicitacoes/enviadas"
                      className={`${submenuItemBase}
                        ${
                          pathname === '/dashboard/solicitacoes/enviadas'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                       <Send size={16} /> <span className={labelBase}>Solicitações Enviadas</span>
                    </Link>
                  )}

                   {solicitacaoFeatures.recebidas && (
                    <Link
                      href="/dashboard/solicitacoes/recebidas"
                      className={`${submenuItemBase}
                        ${
                          pathname === '/dashboard/solicitacoes/recebidas'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Inbox size={16} />
                      <span className={labelBase}>Solicitações Recebidas</span>
                      {!collapsed && receivedSolicitationsCount !== null && receivedSolicitationsCount > 0 && (
                        <span className={`${badgeBase} bg-sky-500 text-white`}>
                          {receivedSolicitationsCount}
                        </span>
                      )}
                    </Link>
                  )}

                  {/* 👉 Painel de Aprovações – só aparece para quem pode aprovar */}
                    {canApprove && solicitacaoFeatures.aprovacao && (
                    <Link
                      href="/dashboard/solicitacoes/aprovacao"
                      className={`${submenuItemBase}
                        ${
                          pathname === '/dashboard/solicitacoes/aprovacao'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                       <CheckCircle2 size={16} /> <span className={labelBase}>Aprovações</span>
                    </Link>
                  )}

                  {solicitacaoFeatures.cadastros && (
                    <Link
                      href="/dashboard/solicitacoes/cadastros"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith(
                            '/dashboard/solicitacoes/cadastros',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <FolderCog size={16} /> <span className={labelBase}>Cadastros</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {showConfig && (
            <div>
              {/* Cabeçalho do grupo Configurações */}
              <button
                type="button"
                onClick={() => setOpenConfig((v) => !v)}
                className={`${baseSection} ${
                  inConfig ? activeSection : inactiveSection
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
                  <Settings className="h-5 w-5 shrink-0" />
                </span>
                {!collapsed && <span className={labelBase}>Configurações</span>}
              </button>

              {/* Submenu */}
              {openConfig && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                   {configFeatures.painel && (
                    <Link
                      href="/dashboard/configuracoes"
                      className={`${submenuItemBase}
                        ${
                          pathname === '/dashboard/configuracoes'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                       <Settings size={16} /> <span className={labelBase}>Painel</span>
                    </Link>
                  )}

                  {configFeatures.usuarios && (
                    <Link
                      href="/dashboard/configuracoes/usuarios"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith('/dashboard/configuracoes/usuarios')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Users size={16} /> <span className={labelBase}>Usuários</span>
                    </Link>
                  )}

                  {configFeatures.permissoes && (
                    <Link
                      href="/dashboard/configuracoes/permissoes"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith(
                            '/dashboard/configuracoes/permissoes',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                       <Shield size={16} /> <span className={labelBase}>Permissões</span>
                    </Link>
                  )}

                  {configFeatures.centros && (
                    <Link
                      href="/dashboard/configuracoes/centros-de-custo"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith(
                            '/dashboard/configuracoes/centros-de-custo',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <FolderCog size={16} /> <span className={labelBase}>Centros de Custo</span>
                    </Link>
                  )}

                  {configFeatures.cargos && (
                    <Link
                      href="/dashboard/configuracoes/cargos"
                      className={`${submenuItemBase}
                        ${
                          pathname.startsWith(
                            '/dashboard/configuracoes/cargos',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                     <FolderCog size={16} /> <span className={labelBase}>Cargos</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      <div className="px-3 py-3 border-t border-white/10">{userMenu}</div>
    </aside>
  )
}