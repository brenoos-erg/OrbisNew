'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const isActive = pathname?.startsWith('/dashboard/solicitacoes')

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-[#0f172a] text-slate-200 shadow-xl">
      {/* topo / logo */}
      <div className="flex items-center gap-2 px-5 h-14 border-b border-white/5">
        <div className="h-8 w-8 rounded-md bg-white/10 grid place-items-center">
          <span className="text-xs font-semibold">Orbis</span>
        </div>
        <div className="leading-tight">
          <p className="font-semibold">Visão 360º</p>
          <p className="text-xs text-slate-400">dos contratos</p>
        </div>
      </div>

      {/* menu */}
      <nav className="mt-4 px-3">
        <p className="px-2 mb-2 text-[11px] uppercase tracking-wide text-slate-400">
          Ações rápidas
        </p>

        <Link
          href="/dashboard/solicitacoes"
          className={[
            'group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
            isActive
              ? 'bg-white/10 text-white ring-1 ring-white/10'
              : 'hover:bg-white/5 hover:text-white',
          ].join(' ')}
        >
          <span className="relative">
            <FileText className="h-4 w-4" />
            {/* detalhe laranja à esquerda, igual ao visual da referência */}
            <span
              className={[
                'absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-1 rounded',
                isActive ? 'bg-orange-500' : 'bg-transparent group-hover:bg-orange-500/70',
              ].join(' ')}
            />
          </span>
          <span>Solicitações</span>
        </Link>
      </nav>

      {/* rodapé da barra (descrição suave) */}
      <div className="absolute bottom-3 inset-x-0 px-4 text-[11px] text-slate-500">
        <div className="h-px bg-white/5 mb-3" />
        <p>TI • ERG</p>
      </div>
    </aside>
  )
}
