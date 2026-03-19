'use client'

import Link from 'next/link'

type SstModuleTabsProps = {
  active: 'nao-conformidades' | 'planos-de-acao'
}

export default function SstModuleTabs({ active }: SstModuleTabsProps) {
  return (
    <nav
      aria-label="Submódulos de SST"
      className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
    >
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/sst/nao-conformidades"
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            active === 'nao-conformidades'
              ? 'bg-orange-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Não conformidades
        </Link>
        <Link
          href="/dashboard/sst/planos-de-acao"
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            active === 'planos-de-acao'
              ? 'bg-orange-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Plano de ação (submódulo)
        </Link>
      </div>
    </nav>
  )
}