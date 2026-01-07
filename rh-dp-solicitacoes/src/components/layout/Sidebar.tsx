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

  const baseSection =
    'w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-md transition-colors cursor-pointer'
  const activeSection = 'bg-orange-500 text-white shadow-sm'
  const inactiveSection = 'text-slate-200 hover:bg-white/10'

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
                <Truck className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Gestão de Frotas</span>}
              </button>

              {openFleet && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                    {fleetFeatures.veiculos && (
                    <Link
                      href="/dashboard/gestao-de-frotas/veiculos"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/veiculos')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Truck size={16} /> <span>Veículos</span>
                    </Link>
                  )}

                  {fleetFeatures.checkins && (
                    <Link
                      href="/dashboard/gestao-de-frotas/checkins"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/checkins')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <ClipboardCheck size={16} /> <span>Check-ins diários</span>
                    </Link>
                  )}
                  {fleetFeatures.deslocamentoCheckin && (
                    <Link
                      href="/dashboard/gestao-de-frotas/deslocamento/checkin"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/deslocamento/checkin')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Route size={16} /> <span>Check-in de deslocamento</span>
                    </Link>
                  )}
                  {fleetFeatures.deslocamentoPainel && (
                    <Link
                      href="/dashboard/gestao-de-frotas/deslocamento/painel"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/gestao-de-frotas/deslocamento/painel')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <LayoutDashboard size={16} /> <span>Painel deslocamentos</span>
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
                <Package className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Controle de Equipamentos TI</span>}
              </button>

              {openEquipment && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                   {equipmentFeatures.atalho && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/atalho"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/atalho')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <ScanLine size={16} /> <span>Atalho rápido</span>
                    </Link>
                  )}
                  {equipmentFeatures.linhaTelefonica && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/linha-telefonica"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/linha-telefonica')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Phone size={16} /> <span>Linhas telefônicas</span>
                    </Link>
                  )}
                  {equipmentFeatures.smartphone && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/smartphones"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/smartphones')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Smartphone size={16} /> <span>Smartphones</span>
                    </Link>
                  )}
                  {equipmentFeatures.notebook && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/notebooks"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/notebooks')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Laptop size={16} /> <span>Notebooks</span>
                    </Link>
                  )}
                  {equipmentFeatures.desktop && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/desktops"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/desktops')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Cpu size={16} /> <span>Desktops</span>
                    </Link>
                  )}
                  {equipmentFeatures.monitor && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/monitores"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/monitores')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Monitor size={16} /> <span>Monitores</span>
                    </Link>
                  )}
                  {equipmentFeatures.impressora && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/impressoras"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/impressoras')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Printer size={16} /> <span>Impressoras</span>
                    </Link>
                  )}
                  {equipmentFeatures.tplink && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/tplink"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/tplink')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Router size={16} /> <span>TP-Link</span>
                    </Link>
                  )}
                  {equipmentFeatures.outros && (
                    <Link
                      href="/dashboard/controle-equipamentos-ti/outros"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/controle-equipamentos-ti/outros')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Package size={16} /> <span>Outros equipamentos</span>
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
                <ShieldAlert className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Direito de Recusa</span>}
              </button>

              {openRefusal && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  {canAccessRefusalPanel && refusalFeatures.painel && (
                    <Link
                      href="/dashboard/direito-de-recusa"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname === '/dashboard/direito-de-recusa'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                      >
                      <ShieldAlert size={16} /> <span>Painel</span>
                    </Link>
                  )}
                   {refusalFeatures.minhas && (
                    <Link
                      href="/dashboard/direito-de-recusa/minhas"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/direito-de-recusa/minhas')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <ClipboardList size={16} /> <span>Meus direitos de recusa</span>
                    </Link>
                  )}
                  {refusalFeatures.nova && (
                    <Link
                      href="/dashboard/direito-de-recusa/nova"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/direito-de-recusa/nova')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <ClipboardList size={16} /> <span>Registrar recusa</span>
                    </Link>
                  )}
                  {canReviewRefusal && refusalFeatures.pendentes && (
                    <Link
                      href="/dashboard/direito-de-recusa/pendentes"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname === '/dashboard/direito-de-recusa/pendentes'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <CheckCircle2 size={16} /> <span>Pendentes para avaliar</span>
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
                <ClipboardList className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Solicitações</span>}
              </button>

              {/* Submenu – só aparece se não estiver colapsado e se estiver "openSolic" */}
              {openSolic && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  {solicitacaoFeatures.enviadas && (
                    <Link
                      href="/dashboard/solicitacoes/enviadas"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname === '/dashboard/solicitacoes/enviadas'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Send size={16} /> <span>Solicitações Enviadas</span>
                    </Link>
                  )}

                   {solicitacaoFeatures.recebidas && (
                    <Link
                      href="/dashboard/solicitacoes/recebidas"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname === '/dashboard/solicitacoes/recebidas'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Inbox size={16} /> <span>Solicitações Recebidas</span>
                    </Link>
                  )}

                  {/* 👉 Painel de Aprovações – só aparece para quem pode aprovar */}
                    {canApprove && solicitacaoFeatures.aprovacao && (
                    <Link
                      href="/dashboard/solicitacoes/aprovacao"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname === '/dashboard/solicitacoes/aprovacao'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <CheckCircle2 size={16} /> <span>Aprovações</span>
                    </Link>
                  )}

                  {solicitacaoFeatures.cadastros && (
                    <Link
                      href="/dashboard/solicitacoes/cadastros"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith(
                            '/dashboard/solicitacoes/cadastros',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <FolderCog size={16} /> <span>Cadastros</span>
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
                <Settings className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Configurações</span>}
              </button>

              {/* Submenu */}
              {openConfig && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                   {configFeatures.painel && (
                    <Link
                      href="/dashboard/configuracoes"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname === '/dashboard/configuracoes'
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Settings size={16} /> <span>Painel</span>
                    </Link>
                  )}

                  {configFeatures.usuarios && (
                    <Link
                      href="/dashboard/configuracoes/usuarios"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith('/dashboard/configuracoes/usuarios')
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Users size={16} /> <span>Usuários</span>
                    </Link>
                  )}

                  {configFeatures.permissoes && (
                    <Link
                      href="/dashboard/configuracoes/permissoes"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith(
                            '/dashboard/configuracoes/permissoes',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <Shield size={16} /> <span>Permissões</span>
                    </Link>
                  )}

                  {configFeatures.centros && (
                    <Link
                      href="/dashboard/configuracoes/centros-de-custo"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith(
                            '/dashboard/configuracoes/centros-de-custo',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <FolderCog size={16} /> <span>Centros de Custo</span>
                    </Link>
                  )}

                  {configFeatures.cargos && (
                    <Link
                      href="/dashboard/configuracoes/cargos"
                      className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
                        ${
                          pathname.startsWith(
                            '/dashboard/configuracoes/cargos',
                          )
                            ? 'bg-orange-500/90 text-white'
                            : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'
                        }`}
                    >
                      <FolderCog size={16} /> <span>Cargos</span>
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
