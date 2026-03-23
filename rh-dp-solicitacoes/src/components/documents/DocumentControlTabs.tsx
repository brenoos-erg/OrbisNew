'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard/controle-documentos/publicados', label: 'Documentos Publicados' },
  { href: '/dashboard/controle-documentos/para-aprovacao', label: 'Documentos para Aprovação' },
  { href: '/dashboard/controle-documentos/em-analise-qualidade', label: 'Documentos em Revisão da Qualidade' },
  { href: '/dashboard/controle-documentos/controle-aprovadores', label: 'Controle de Aprovadores' },
]

export default function DocumentControlTabs() {
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded px-3 py-2 text-sm ${active ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}