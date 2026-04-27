import {
  AlertCircle,
  CheckCircle2,
  CircleSlash,
  Clock3,
  FileCheck2,
  FileSignature,
  Hourglass,
  ShieldCheck,
  UserRoundCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type SolicitationStatusPresentation = {
  label: string
  description?: string
  icon: LucideIcon
  className: string
}

const STATUS_PRESENTATION_MAP: Record<string, SolicitationStatusPresentation> = {
  ABERTA: {
    label: 'Aguardando atendimento',
    description: 'Solicitação aberta aguardando início de atendimento.',
    icon: Clock3,
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60',
  },
  AGUARDANDO_ATENDIMENTO: {
    label: 'Aguardando atendimento',
    description: 'Solicitação na fila de atendimento.',
    icon: Hourglass,
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60',
  },
  EM_ATENDIMENTO: {
    label: 'Em atendimento',
    description: 'A equipe responsável está tratando esta solicitação.',
    icon: Wrench,
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800/60',
  },
  AGUARDANDO_APROVACAO: {
    label: 'Aguardando aprovação',
    description: 'Aguardando validação de um aprovador.',
    icon: ShieldCheck,
    className:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800/60',
  },
  AGUARDANDO_TERMO: {
    label: 'Aguardando termo',
    description: 'Aguardando assinatura/confirmação de termo.',
    icon: FileSignature,
    className:
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-800/60',
  },
  AGUARDANDO_AVALIACAO_GESTOR: {
    label: 'Avaliação do gestor',
    description: 'Aguardando avaliação do gestor responsável.',
    icon: UserRoundCheck,
    className:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800/60',
  },
  AGUARDANDO_FINALIZACAO_AVALIACAO: {
    label: 'Finalização RH',
    description: 'Aguardando finalização da avaliação pelo RH.',
    icon: FileCheck2,
    className:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800/60',
  },
  CONCLUIDA: {
    label: 'Concluída',
    description: 'Solicitação concluída com sucesso.',
    icon: CheckCircle2,
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60',
  },
  CANCELADA: {
    label: 'Cancelada',
    description: 'Solicitação cancelada/recusada.',
    icon: CircleSlash,
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800/60',
  },
}

function normalizeUnknownStatus(status: string) {
  return status
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^\w)|\s+(\w)/g, (match) => match.toUpperCase())
}

export function getStatusPresentation(status?: string | null): SolicitationStatusPresentation {
  if (!status || !status.trim()) {
    return {
      label: '-',
      description: 'Sem status informado.',
      icon: AlertCircle,
      className:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
    }
  }

  return (
    STATUS_PRESENTATION_MAP[status] ?? {
      label: normalizeUnknownStatus(status),
      description: 'Status não mapeado.',
      icon: AlertCircle,
      className:
        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
    }
  )
}
