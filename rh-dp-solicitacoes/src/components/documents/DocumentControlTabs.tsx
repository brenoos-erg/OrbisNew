'use client'

import { BellRing, CheckCheck, ClipboardCheck, FileCheck2, Files, History } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'

type TabItem = { href: string; label: string; adminOnly?: boolean; icon: ComponentType<{ className?: string }> }

const TABS: TabItem[] = [
  { href: '/dashboard/controle-documentos/publicados', label: 'Documentos Publicados', icon: Files },
  { href: '/dashboard/controle-documentos/para-aprovacao', label: 'Documentos para Aprovação', icon: ClipboardCheck },
  { href: '/dashboard/controle-documentos/em-analise-qualidade', label: 'Documentos em Revisão da Qualidade', icon: FileCheck2 },
  { href: '/dashboard/controle-documentos/historico', label: 'Histórico', icon: History },
  { href: '/dashboard/controle-documentos/notificacoes', label: 'Notificações', adminOnly: true, icon: BellRing },
  { href: '/dashboard/controle-documentos/controle-aprovadores', label: 'Controle de Aprovadores', adminOnly: true, icon: CheckCheck },
]

type Props = {
  isAdmin?: boolean
  canAccessApprovalDocuments?: boolean
  canAccessQualityReviewDocuments?: boolean
}

export default function DocumentControlTabs({
  isAdmin = false,
  canAccessApprovalDocuments = false,
  canAccessQualityReviewDocuments = false,
}: Props) {
  const pathname = usePathname()
  const visibleTabs = TABS.filter((tab) => {
    if (tab.adminOnly && !isAdmin) return false
    if (tab.href.endsWith('/para-aprovacao') && !canAccessApprovalDocuments) return false
    if (tab.href.endsWith('/em-analise-qualidade') && !canAccessQualityReviewDocuments) return false
    return true
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 border-b border-slate-100 px-2 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gestão de Documentos</p>
        <p className="text-sm text-slate-600">Selecione a etapa do fluxo para consultar, aprovar e administrar documentos.</p>
      </div>
      <div className="flex flex-wrap gap-2">
      {visibleTabs.map((tab) => {
        const active = pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              active
                ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
      </div>
    </div>
  )
}
