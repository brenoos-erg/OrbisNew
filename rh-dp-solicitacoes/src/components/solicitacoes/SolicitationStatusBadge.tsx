'use client'

const statusClasses: Record<string, string> = {
  ABERTA: 'bg-blue-50 text-blue-700 border-blue-100',
  AGUARDANDO_APROVACAO: 'bg-amber-50 text-amber-700 border-amber-100',
  AGUARDANDO_TERMO: 'bg-purple-50 text-purple-700 border-purple-100',
  EM_ATENDIMENTO: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  CONCLUIDA: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  CANCELADA: 'bg-rose-50 text-rose-700 border-rose-100',
}

export function SolicitationStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-500">-</span>
  const tone = statusClasses[status] ?? 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status}
    </span>
  )
}