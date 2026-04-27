'use client'

import { useEffect, useMemo, useState } from 'react'

const STATUS_OPTIONS = [
  'AGUARDANDO_ENVIO',
  'ENVIADO_PELO_CANDIDATO',
  'EM_CONFERENCIA',
  'PENDENTE',
  'CONCLUIDO',
]

const EMAIL_STATUS_OPTIONS = ['ALL', 'SENT', 'RESENT', 'FAILED', 'NOT_SENT'] as const

type Row = {
  id: string
  protocolo: string
  status: string
  candidateName: string
  candidateEmail: string
  externalUrl: string | null
  emailDeliveryStatus: string
  emailSentAt: string | null
  emailResentAt: string | null
  emailError: string | null
  sentDocuments: number
  totalDocuments: number
  updatedAt: string
}

type FeedbackType = 'success' | 'error' | 'info'
type Feedback = { type: FeedbackType; message: string } | null

type StatusMeta = {
  label: string
  badgeClass: string
}

const STATUS_META: Record<string, StatusMeta> = {
  AGUARDANDO_ENVIO: {
    label: 'Aguardando envio',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  ENVIADO_PELO_CANDIDATO: {
    label: 'Enviado pelo candidato',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  EM_CONFERENCIA: {
    label: 'Em conferência',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',
  },
  PENDENTE: {
    label: 'Pendente',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  CONCLUIDO: {
    label: 'Concluído',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
}

const EMAIL_META: Record<string, StatusMeta> = {
  SENT: {
    label: 'Enviado',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  RESENT: {
    label: 'Reenviado',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  FAILED: {
    label: 'Falha no envio',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
  },
  NOT_SENT: {
    label: 'Não enviado',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' }
}

function getEmailMeta(status: string): StatusMeta {
  return EMAIL_META[status] ?? { label: status, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR')
}

function getProgress(sentDocuments: number, totalDocuments: number) {
  if (!totalDocuments) return 0
  return Math.min(100, Math.round((sentDocuments / totalDocuments) * 100))
}

function feedbackClass(type: FeedbackType) {
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (type === 'error') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-sky-200 bg-sky-50 text-sky-800'
}

export default function ExternalAdmissionDashboardPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [emailStatusFilter, setEmailStatusFilter] = useState<(typeof EMAIL_STATUS_OPTIONS)[number]>('ALL')

  async function load(options?: { silent?: boolean }) {
    setAccessDenied(false)
    setLoadingError(null)

    if (options?.silent) {
      setIsReloading(true)
    } else {
      setIsLoading(true)
    }

    try {
      const res = await fetch('/api/solicitacoes/externas/admissao', { cache: 'no-store' })
      if (res.status === 403) {
        setAccessDenied(true)
        setRows([])
        return
      }
      if (!res.ok) {
        setLoadingError('Não foi possível carregar a lista de processos.')
        return
      }
      const payload = await res.json()
      setRows(payload.rows ?? [])
    } catch {
      setLoadingError('Erro inesperado ao carregar os processos.')
    } finally {
      setIsLoading(false)
      setIsReloading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createProcess() {
    const trimmedName = candidateName.trim()
    const trimmedEmail = candidateEmail.trim().toLowerCase()

    setFeedback(null)
    setGeneratedLink(null)

    if (!trimmedName || !trimmedEmail) {
      setFeedback({ type: 'error', message: 'Preencha o nome e o e-mail do candidato.' })
      return
    }

    const basicEmailOk = /.+@.+\..+/.test(trimmedEmail)
    if (!basicEmailOk) {
      setFeedback({ type: 'error', message: 'Informe um e-mail válido para o candidato.' })
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/solicitacoes/externas/admissao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateName: trimmedName, candidateEmail: trimmedEmail }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 403) {
          setAccessDenied(true)
        }
        setFeedback({ type: 'error', message: payload?.error ?? 'Não foi possível criar o processo.' })
        return
      }

      setGeneratedLink(payload?.externalUrl ?? null)
      setCandidateName('')
      setCandidateEmail('')
      setFeedback({
        type: payload?.emailSent ? 'success' : 'info',
        message: payload?.emailSent
          ? 'Processo criado e e-mail enviado ao candidato.'
          : `Processo criado sem envio de e-mail. Erro: ${payload?.emailError ?? 'desconhecido'}`,
      })
      await load({ silent: true })
    } catch {
      setFeedback({ type: 'error', message: 'Erro inesperado ao criar o processo.' })
    } finally {
      setIsCreating(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingStatusId(id)
    setFeedback(null)
    try {
      const res = await fetch(`/api/solicitacoes/externas/admissao/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 403) {
        setAccessDenied(true)
        setFeedback({ type: 'error', message: 'Apenas usuários de RH podem alterar solicitações externas.' })
        return
      }
      if (!res.ok) {
        setFeedback({ type: 'error', message: payload?.error ?? 'Não foi possível atualizar o status.' })
        return
      }
      await load({ silent: true })
    } finally {
      setUpdatingStatusId(null)
    }
  }

  async function resendEmail(id: string) {
    setResendingId(id)
    setFeedback(null)
    try {
      const res = await fetch(`/api/solicitacoes/externas/admissao/${id}`, { method: 'POST' })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 403) {
          setAccessDenied(true)
        }
        setFeedback({ type: 'error', message: payload?.error ?? 'Falha ao reenviar e-mail.' })
        return
      }

      setFeedback({
        type: payload?.emailSent ? 'success' : 'error',
        message: payload?.emailSent
          ? 'E-mail reenviado com sucesso.'
          : `Reenvio falhou: ${payload?.emailError ?? 'erro não informado'}`,
      })
      await load({ silent: true })
    } catch {
      setFeedback({ type: 'error', message: 'Erro inesperado ao reenviar o e-mail.' })
    } finally {
      setResendingId(null)
    }
  }

  async function copyLink(url: string | null) {
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setFeedback({ type: 'success', message: 'Link copiado para a área de transferência.' })
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar o link automaticamente.' })
    }
  }

  async function deleteProcess(id: string) {
    const confirmed = window.confirm('Confirma a exclusão desta solicitação externa? Essa ação irá cancelar o processo.')
    if (!confirmed) return

    setDeletingId(id)
    setFeedback(null)

    try {
      const res = await fetch(`/api/solicitacoes/externas/admissao/${id}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 403) {
          setAccessDenied(true)
        }
        setFeedback({ type: 'error', message: payload?.error ?? 'Falha ao excluir solicitação externa.' })
        return
      }

      setFeedback({ type: 'success', message: 'Solicitação externa excluída com sucesso.' })
      await load({ silent: true })
    } catch {
      setFeedback({ type: 'error', message: 'Erro inesperado ao excluir solicitação externa.' })
    } finally {
      setDeletingId(null)
    }
  }

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        row.candidateName.toLowerCase().includes(normalizedSearch) ||
        row.candidateEmail.toLowerCase().includes(normalizedSearch) ||
        row.protocolo.toLowerCase().includes(normalizedSearch)

      const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter
      const matchesEmailStatus = emailStatusFilter === 'ALL' || row.emailDeliveryStatus === emailStatusFilter

      return matchesSearch && matchesStatus && matchesEmailStatus
    })
  }, [rows, searchTerm, statusFilter, emailStatusFilter])

  const summary = useMemo(() => {
    const countStatus = (status: string) => rows.filter((row) => row.status === status).length
    return {
      total: rows.length,
      aguardandoEnvio: countStatus('AGUARDANDO_ENVIO'),
      enviadoPeloCandidato: countStatus('ENVIADO_PELO_CANDIDATO'),
      emConferencia: countStatus('EM_CONFERENCIA'),
      concluido: countStatus('CONCLUIDO'),
      falhaEmail: rows.filter((row) => row.emailDeliveryStatus === 'FAILED').length,
    }
  }, [rows])

  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Acesso negado. Apenas usuários vinculados ao RH podem acessar solicitações externas de admissão.
        </div>
      </div>
    )
  }

  const isCreateDisabled = isCreating || !candidateName.trim() || !candidateEmail.trim()

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Solicitações Externas — Admissão</h1>
        <p className="text-sm text-slate-600">
          Gere links externos para candidatos enviarem documentos de admissão, acompanhe o progresso e gerencie o envio de e-mails.
        </p>
        {isReloading && <p className="text-xs text-slate-500">Atualizando dados...</p>}
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total de processos', value: summary.total, accent: 'text-slate-900' },
          { label: 'Aguardando envio', value: summary.aguardandoEnvio, accent: 'text-amber-700' },
          { label: 'Enviado pelo candidato', value: summary.enviadoPeloCandidato, accent: 'text-sky-700' },
          { label: 'Em conferência', value: summary.emConferencia, accent: 'text-violet-700' },
          { label: 'Concluídos', value: summary.concluido, accent: 'text-emerald-700' },
          { label: 'Falhas de e-mail', value: summary.falhaEmail, accent: 'text-red-700' },
        ].map((card) => (
          <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.accent}`}>{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-4 shadow-sm md:p-5">
        <h2 className="text-base font-semibold text-slate-900">Novo processo externo</h2>
        <p className="mt-1 text-sm text-slate-600">Preencha os dados do candidato para gerar o link e enviar o e-mail de acesso.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Nome do candidato</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              placeholder="Ex.: Maria Aparecida Silva"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">E-mail do candidato</span>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              placeholder="nome.sobrenome@exemplo.com"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={createProcess}
              disabled={isCreateDisabled}
            >
              {isCreating ? 'Criando processo...' : 'Criar processo e enviar e-mail'}
            </button>
          </div>
        </div>

        {generatedLink && (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <p className="font-medium">Link gerado com sucesso</p>
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
              <a className="truncate text-sky-700 underline" href={generatedLink} target="_blank" rel="noreferrer">
                {generatedLink}
              </a>
              <button
                type="button"
                className="rounded border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                onClick={() => copyLink(generatedLink)}
              >
                Copiar link
              </button>
            </div>
          </div>
        )}
      </section>

      {feedback && <div className={`rounded-lg border px-4 py-3 text-sm ${feedbackClass(feedback.type)}`}>{feedback.message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Buscar por candidato, e-mail ou protocolo</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite para filtrar"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Status do processo</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="ALL">Todos</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getStatusMeta(status).label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Status do e-mail</span>
            <select
              value={emailStatusFilter}
              onChange={(e) => setEmailStatusFilter(e.target.value as (typeof EMAIL_STATUS_OPTIONS)[number])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="ALL">Todos</option>
              {EMAIL_STATUS_OPTIONS.filter((status) => status !== 'ALL').map((status) => (
                <option key={status} value={status}>
                  {getEmailMeta(status).label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loadingError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadingError}</div>}

        {isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Carregando processos...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum processo encontrado para os filtros aplicados.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Protocolo / Candidato</th>
                    <th className="px-3 py-2">Checklist</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">E-mail</th>
                    <th className="px-3 py-2">Datas</th>
                    <th className="px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const statusMeta = getStatusMeta(row.status)
                    const emailMeta = getEmailMeta(row.emailDeliveryStatus)
                    const progress = getProgress(row.sentDocuments, row.totalDocuments)

                    return (
                      <tr key={row.id} className="border-t align-top">
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-900">{row.protocolo}</p>
                          <p className="text-slate-700">{row.candidateName}</p>
                          <p className="text-xs text-slate-500">{row.candidateEmail}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-700">
                              {row.sentDocuments}/{row.totalDocuments} documento(s)
                            </p>
                            <div className="h-2 w-44 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-orange-500" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-xs text-slate-500">{progress}% concluído</p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                          <div className="mt-2">
                            <select
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                              value={row.status}
                              onChange={(e) => updateStatus(row.id, e.target.value)}
                              disabled={updatingStatusId === row.id}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {getStatusMeta(status).label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${emailMeta.badgeClass}`}>{emailMeta.label}</span>
                          <div className="mt-2 space-y-1 text-slate-500">
                            {row.emailSentAt && <p>Enviado: {formatDate(row.emailSentAt)}</p>}
                            {row.emailResentAt && <p>Reenviado: {formatDate(row.emailResentAt)}</p>}
                            {row.emailError && (
                              <p className="font-medium text-red-700" title={row.emailError}>
                                ⚠ Erro: {row.emailError}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          <p>Atualizado: {formatDate(row.updatedAt)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="grid gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => copyLink(row.externalUrl)}
                            >
                              Copiar link
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              onClick={() => resendEmail(row.id)}
                              disabled={resendingId === row.id}
                            >
                              {resendingId === row.id ? 'Reenviando...' : 'Reenviar e-mail'}
                            </button>
                            {row.externalUrl && (
                              <a
                                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                href={row.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Abrir checklist
                              </a>
                            )}
                            <a
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              href={`/api/solicitacoes/externas/admissao/${row.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir detalhes
                            </a>
                            <button
                              type="button"
                              className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                              onClick={() => deleteProcess(row.id)}
                              disabled={deletingId === row.id}
                            >
                              {deletingId === row.id ? 'Excluindo...' : 'Excluir'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {filteredRows.map((row) => {
                const statusMeta = getStatusMeta(row.status)
                const emailMeta = getEmailMeta(row.emailDeliveryStatus)
                const progress = getProgress(row.sentDocuments, row.totalDocuments)
                return (
                  <article key={row.id} className="rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.protocolo}</p>
                        <p className="text-sm text-slate-700">{row.candidateName}</p>
                        <p className="text-xs text-slate-500">{row.candidateEmail}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-slate-700">
                        Checklist: {row.sentDocuments}/{row.totalDocuments} documento(s)
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-orange-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-slate-500">{progress}% concluído</p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${emailMeta.badgeClass}`}>{emailMeta.label}</span>
                      <span className="text-slate-500">Atualizado: {formatDate(row.updatedAt)}</span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      {row.emailSentAt && <p>Enviado: {formatDate(row.emailSentAt)}</p>}
                      {row.emailResentAt && <p>Reenviado: {formatDate(row.emailResentAt)}</p>}
                      {row.emailError && (
                        <p className="font-medium text-red-700" title={row.emailError}>
                          ⚠ Erro: {row.emailError}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" onClick={() => copyLink(row.externalUrl)}>
                        Copiar link
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                        onClick={() => resendEmail(row.id)}
                        disabled={resendingId === row.id}
                      >
                        {resendingId === row.id ? 'Reenviando...' : 'Reenviar e-mail'}
                      </button>
                      <a
                        className="rounded-lg border px-2.5 py-1.5 text-center text-xs font-semibold"
                        href={`/api/solicitacoes/externas/admissao/${row.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir detalhes
                      </a>
                      {row.externalUrl ? (
                        <a
                          className="rounded-lg border px-2.5 py-1.5 text-center text-xs font-semibold"
                          href={row.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir checklist
                        </a>
                      ) : (
                        <span className="rounded-lg border border-dashed px-2.5 py-1.5 text-center text-xs text-slate-400">Sem checklist</span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <select
                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        value={row.status}
                        onChange={(e) => updateStatus(row.id, e.target.value)}
                        disabled={updatingStatusId === row.id}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {getStatusMeta(status).label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                        onClick={() => deleteProcess(row.id)}
                        disabled={deletingId === row.id}
                      >
                        {deletingId === row.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
