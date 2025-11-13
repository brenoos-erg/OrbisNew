// src/components/layout/Sidebar.tsx
// src/components/layout/Sidebar.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ChevronLeft, Send, Inbox, FolderCog, Settings, Users, Shield } from 'lucide-react'
import { usePathname } from 'next/navigation'   // 👈 ADD

type Props = {
  showSolic: boolean
  showConfig: boolean
  userMenu: React.ReactNode
}

export default function Sidebar({ showSolic, showConfig, userMenu }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const pathname = usePathname()
  const inSolic = pathname.startsWith('/dashboard/solicitacoes')
  const inConfig = pathname.startsWith('/dashboard/configuracoes')

  const [openSolic, setOpenSolic] = useState(inSolic)
  const [openConfig, setOpenConfig] = useState(inConfig)

  // quando mudar de rota, abre o grupo correspondente e fecha o outro
  useEffect(() => {
    if (inSolic) {
      setOpenSolic(true)
      setOpenConfig(false)
    } else if (inConfig) {
      setOpenConfig(true)
      setOpenSolic(false)
    }
  }, [inSolic, inConfig])

  // Lembra estado entre reloads (já existia)
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
      className={`fixed left-0 top-0 h-screen bg-[#0f172a] text-slate-200 shadow-xl flex flex-col justify-between transition-all duration-200
        ${collapsed ? 'w-16' : 'w-72'}`}
    >
      <div>
        {/* Cabeçalho com botão recolher/expandir */}
        <div className="h-16 flex items-center px-3 border-b border-white/10">
          {!collapsed && <div className="font-semibold mr-2">Sistema de Solicitações</div>}
          <button
            onClick={() => setCollapsed(v => !v)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="ml-auto rounded-md p-2 hover:bg-white/10"
          >
            <ChevronLeft size={18} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* MENU */}
        <nav className="px-3 space-y-2 mt-2">
          {showSolic && (
            <div>
              {/* Cabeçalho do grupo Solicitacoes */}
              <button
                type="button"
                onClick={() => setOpenSolic((v) => !v)}
                className={`${baseSection} ${inSolic ? activeSection : inactiveSection}`}
              >
                <ClipboardList className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Solicitações</span>}
              </button>

              {/* Submenu – só aparece se não estiver colapsado e se estiver "openSolic" */}
              {openSolic && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  <Link
                    href="/dashboard/solicitacoes/enviadas"
                    className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
            ${pathname === '/dashboard/solicitacoes/enviadas'
                        ? 'bg-orange-500/90 text-white'
                        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'}
          `}
                  >
                    <Send size={16} /> <span>Solicitações Enviadas</span>
                  </Link>

                  <Link
                    href="/dashboard/solicitacoes/recebidas"
                    className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
            ${pathname === '/dashboard/solicitacoes/recebidas'
                        ? 'bg-orange-500/90 text-white'
                        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'}
          `}
                  >
                    <Inbox size={16} /> <span>Solicitações Recebidas</span>
                  </Link>

                  <Link
                    href="/dashboard/solicitacoes/cadastros"
                    className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
            ${pathname.startsWith('/dashboard/solicitacoes/cadastros')
                        ? 'bg-orange-500/90 text-white'
                        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'}
          `}
                  >
                    <FolderCog size={16} /> <span>Cadastros</span>
                  </Link>
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
                className={`${baseSection} ${inConfig ? activeSection : inactiveSection}`}
              >
                <Settings className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Configurações</span>}
              </button>

              {/* Submenu */}
              {openConfig && !collapsed && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  <Link
                    href="/dashboard/configuracoes"
                    className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
            ${pathname === '/dashboard/configuracoes'
                        ? 'bg-orange-500/90 text-white'
                        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'}
          `}
                  >
                    <Settings size={16} /> <span>Painel</span>
                  </Link>

                  <Link
                    href="/dashboard/configuracoes/usuarios"
                    className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
            ${pathname.startsWith('/dashboard/configuracoes/usuarios')
                        ? 'bg-orange-500/90 text-white'
                        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'}
          `}
                  >
                    <Users size={16} /> <span>Usuários</span>
                  </Link>

                  <Link
                    href="/dashboard/configuracoes/permissoes"
                    className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
            ${pathname.startsWith('/dashboard/configuracoes/permissoes')
                        ? 'bg-orange-500/90 text-white'
                        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'}
          `}
                  >
                    <Shield size={16} /> <span>Permissões</span>
                  </Link>

                  <Link
                    href="/dashboard/configuracoes/centros-de-custo"
                    className={`group flex items-center gap-3 rounded-md text-sm font-medium px-4 py-3
            ${pathname.startsWith('/dashboard/configuracoes/centros-de-custo')
                        ? 'bg-orange-500/90 text-white'
                        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white'}
          `}
                  >
                    <FolderCog size={16} /> <span>Centros de Custo</span>
                  </Link>
                </div>
              )}
            </div>
          )}

        </nav>
      </div>

      <div className="px-3 py-3 border-t border-white/10">
        {userMenu}
      </div>
    </aside>
  )
}
