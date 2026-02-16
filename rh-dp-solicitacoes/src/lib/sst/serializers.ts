import { NonConformityStatus } from '@prisma/client'

export const statusLabel: Record<NonConformityStatus, string> = {
  ABERTA: 'Aberta',
  EM_TRATATIVA: 'Em tratativa',
  AGUARDANDO_VERIFICACAO: 'Aguardando verificação',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
}

export const statusColor: Record<NonConformityStatus, string> = {
  ABERTA: 'bg-amber-100 text-amber-800',
  EM_TRATATIVA: 'bg-sky-100 text-sky-800',
  AGUARDANDO_VERIFICACAO: 'bg-violet-100 text-violet-800',
  ENCERRADA: 'bg-emerald-100 text-emerald-800',
  CANCELADA: 'bg-rose-100 text-rose-800',
}