import { NonConformityActionStatus, NonConformityStatus, NonConformityType } from '@prisma/client'

export const statusLabel: Record<NonConformityStatus, string> = {
  ABERTA: 'Aberta',
  AGUARDANDO_APROVACAO_QUALIDADE: 'Aguardando aprovação da qualidade',
  APROVADA_QUALIDADE: 'Aprovada pela qualidade',
  EM_TRATATIVA: 'Em tratativa',
  AGUARDANDO_VERIFICACAO: 'Aguardando verificação',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
}

export const statusColor: Record<NonConformityStatus, string> = {
  ABERTA: 'bg-amber-100 text-amber-800',
  AGUARDANDO_APROVACAO_QUALIDADE: 'bg-orange-100 text-orange-800',
  APROVADA_QUALIDADE: 'bg-teal-100 text-teal-800',
  EM_TRATATIVA: 'bg-sky-100 text-sky-800',
  AGUARDANDO_VERIFICACAO: 'bg-violet-100 text-violet-800',
  ENCERRADA: 'bg-emerald-100 text-emerald-800',
  CANCELADA: 'bg-rose-100 text-rose-800',
}

export const nonConformityTypeLabel: Record<NonConformityType, string> = {
  AUDITORIA_CLIENTE: 'Auditoria de cliente',
  AUDITORIA_EXTERNA: 'Auditoria externa',
  AUDITORIA_INTERNA: 'Auditoria interna',
  OUTROS: 'Outros',
  PROCESSOS: 'Processos',
  NOTIFICACOES_CLIENTE: 'Notificações de cliente',
}

export const actionStatusLabel: Record<NonConformityActionStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}
