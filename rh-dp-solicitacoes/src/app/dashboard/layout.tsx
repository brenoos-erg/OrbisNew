'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserMenu from '@/components/layout/userMenu'
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Send,
  Inbox,
  FolderCog,
  Settings,
  Users,
  Shield
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // estado de colapso do sidebar
  const [collapsed, setCollapsed] = useState(false)

  // estados de expansão dos grupos de menu
  const [solicOpen, setSolicOpen] = useState(true)
  const [configOpen, setConfigOpen] = useState(
    pathname?.startsWith('/dashboard/configuracoes') ?? false
  )

  // --- helpers de ativo ------------------------------------------------------
  const isSolicRoot = pathname?.startsWith('/dashboard/solicitacoes') ?? false
  const isSolicEnviadas = pathname === '/dashboard/solicitacoes/enviadas'
  const isSolicRecebidas = pathname === '/dashboard/solicitacoes/recebidas'
  const isSolicCadastros = pathname === '/dashboard/solicitacoes/cadastros'

  const isConfigRoot = pathname?.startsWith('/dashboard/configuracoes') ?? false
  const isConfigHome = pathname === '/dashboard/configuracoes'
  const isConfigUsuarios = pathname?.startsWith('/dashboard/configuracoes/usuarios') ?? false
  const isConfigPerms = pathname?.startsWith('/dashboard/configuracoes/permissoes') ?? false

  const itemClass = (active?: boolean) =>
    [
      'group flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
      collapsed ? 'justify-center w-12 h-12 p-0' : 'px-4 py-3',
      active ? 'bg-orange-500 text-white shadow-sm'
        : 'text-slate-200 hover:bg-orange-500/90 hover:text-white',
    ].join(' ')

  const hideText = useMemo(() => (collapsed ? 'hidden' : ''), [collapsed])

  return (
    <div className="min-h-screen bg-white text-slate-900 flex">
      {/* SIDEBAR */}
      <aside
        className={[
          'fixed left-0 top-0 h-screen bg-[#0f172a] text-slate-200 shadow-xl flex flex-col justify-between transition-all',
          collapsed ? 'w-[84px]' : 'w-72'
        ].join(' ')}
      >
        <div>
          {/* topo */}
          <div className="px-4 h-16 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-white/10 grid place-items-center text-[11px] font-semibold">
                ERG
              </div>
              <div className={['leading-tight', hideText].join(' ')}>
                <p className="font-semibold text-white">Erg</p>
                <p className="text-[11px] text-slate-400">Manager</p>
              </div>
            </div>

            {/* botão colapsar/expandir */}
            <button
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              onClick={() => setCollapsed(v => !v)}
              className="grid place-items-center rounded-md bg-white/10 hover:bg-white/20 p-1 text-white"
              title={collapsed ? 'Expandir' : 'Recolher'}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* seção: AÇÕES RÁPIDAS */}
          <div className={['px-4 mt-4 mb-2 text-[11px] uppercase tracking-wide text-slate-400', hideText].join(' ')}>
            Ações rápidas
          </div>

          {/* MENU */}
          <nav className={collapsed ? 'space-y-3 flex flex-col items-center mt-2' : 'px-3 space-y-2'}>
            {/* SOLICITAÇÕES (com submenu) */}
            <div>
              <button
                onClick={() => setSolicOpen(v => !v)}
                className={[
                  'transition-colors rounded-md',
                  collapsed ? 'w-12 h-12 grid place-items-center'
                    : 'w-full flex items-center gap-3 px-6 py-3 text-sm font-medium',
                  isSolicRoot ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-200 hover:bg-orange-500/90 hover:text-white',
                ].join(' ')}
                title="Solicitações"
              >
                <ClipboardList className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Solicitações</span>}
                {!collapsed && (
                  <span className="ml-auto">
                    {solicOpen ? <ChevronLeft size={16} className="rotate-90" /> : <ChevronLeft size={16} />}
                  </span>
                )}
              </button>

              {/* submenu */}
              {!collapsed && solicOpen && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  <Link href="/dashboard/solicitacoes/enviadas" className={itemClass(isSolicEnviadas)} title="Solicitações Enviadas">
                    <Send size={16} />
                    <span>Solicitações Enviadas</span>
                  </Link>
                  <Link href="/dashboard/solicitacoes/recebidas" className={itemClass(isSolicRecebidas)} title="Solicitações Recebidas">
                    <Inbox size={16} />
                    <span>Solicitações Recebidas</span>
                  </Link>
                  <Link href="/dashboard/solicitacoes/cadastros" className={itemClass(isSolicCadastros)} title="Cadastros">
                    <FolderCog size={16} />
                    <span>Cadastros</span>
                  </Link>
                </div>
              )}
            </div>

            {/* CONFIGURAÇÕES (com submenu) */}
            <div>
              <button
                onClick={() => setConfigOpen(v => !v)}
                className={[
                  'transition-colors rounded-md',
                  collapsed ? 'w-12 h-12 grid place-items-center'
                    : 'w-full flex items-center gap-3 px-6 py-3 text-sm font-medium',
                  isConfigRoot ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-200 hover:bg-orange-500/90 hover:text-white',
                ].join(' ')}
                title="Configurações"
              >
                <Settings className="h-5 w-5" />
                {!collapsed && <span>Configurações</span>}
                {!collapsed && (
                  <span className="ml-auto">
                    {configOpen ? <ChevronLeft size={16} className="rotate-90" /> : <ChevronLeft size={16} />}
                  </span>
                )}
              </button>

              {!collapsed && configOpen && (
                <div className="mt-1 ml-9 flex flex-col gap-1">
                  <Link href="/dashboard/configuracoes" className={itemClass(isConfigHome)}>
                    <Settings size={16} />
                    <span>Painel</span>
                  </Link>

                  <Link href="/dashboard/configuracoes/usuarios" className={itemClass(isConfigUsuarios)}>
                    <Users size={16} />
                    <span>Usuários</span>
                  </Link>

                  <Link href="/dashboard/configuracoes/permissoes" className={itemClass(isConfigPerms)}>
                    <Shield size={16} />
                    <span>Permissões</span>
                  </Link>
                  <Link
                    href="/dashboard/configuracoes/centros-de-custo"
                    className={itemClass(pathname?.startsWith('/dashboard/configuracoes/centros-de-custo'))}
                  >
                    <FolderCog size={16} />
                    <span>Centros de Custo</span>
                  </Link>

                </div>
              )}
            </div>
          </nav>
        </div>

        {/* rodapé */}
        <div className="px-3 py-3 border-t border-white/10">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className={['flex-1 bg-white transition-all', collapsed ? 'ml-[84px]' : 'ml-72'].join(' ')}>
        <div className="h-16 border-b border-slate-200 flex items-center px-6 text-sm text-slate-600">
          Sistema de Solicitações
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
