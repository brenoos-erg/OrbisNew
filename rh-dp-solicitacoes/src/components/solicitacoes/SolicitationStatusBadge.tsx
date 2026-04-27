'use client'

import { getStatusPresentation } from '@/lib/solicitationStatusPresentation'

type Props = {
  status?: string | null
  className?: string
}

export function SolicitationStatusBadge({ status, className = '' }: Props) {
  const presentation = getStatusPresentation(status)
  const Icon = presentation.icon

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${presentation.className} ${className}`.trim()}
      title={presentation.description}
      aria-label={`Status: ${presentation.label}`}
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{presentation.label}</span>
    </span>
  )
}
