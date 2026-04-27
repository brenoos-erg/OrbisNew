'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { format } from 'date-fns'

type RefusalStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA'

type Attachment = {
  id: string
  filename: string
  url: string
  mimeType: string
  sizeBytes: number
}

type Report = {
  id: string
  createdAt: string
  employeeName: string
  sectorOrContract: string
  riskSituation: string
  locationOrEquipment: string
  detailedCondition: string
  contractManagerName?: string | null
  generalCoordinatorName?: string | null
  status: RefusalStatus
  decision?: boolean | null
  decisionComment?: string | null
  decidedAt?: string | null
  attachments: Attachment[]
}

type Props = {
  reportId: string
  canReview: boolean
}

const statusLabels: Record<RefusalStatus, { label: string; color: string }> = {
  PENDENTE: { label: 'Pendente', color: 'app-status-badge app-status-badge--pending' },
  APROVADA: { label: 'Procede', color: 'app-status-badge app-status-badge--success' },
  REJEITADA: { label: 'Não procede', color: 'app-status-badge app-status-badge--danger' },
}

export default function RefusalDetailClient({ reportId, canReview }: Props) {
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<'SIM' | 'NAO' | ''>('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/direito-de-recusa/${reportId}`, { cache: 'no-store' })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json?.error || 'Erro ao carregar o registro.')
        }
        const json = await res.json()
        setReport(json.report)
        if (json.report?.status !== 'PENDENTE') {
          setDecision(json.report.decision ? 'SIM' : 'NAO')
          setComment(json.report.decisionComment || '')
        }
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar o registro.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [reportId])

  async function submitDecision() {
    if (!report) return
    if (!decision) {
      setError('Selecione se a situação procede ou não.')
      return
    }
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      const res = await fetch(`/api/direito-de-recusa/${report.id}/decisao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decision === 'SIM', comment }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao registrar decisão.')
      }
      const json = await res.json()
      setReport(json.report)
      setSuccess('Decisão registrada com sucesso.')
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Erro ao registrar decisão.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 app-muted-text">
        <Loader2 className="animate-spin" size={18} />
        Carregando
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {error}
      </div>
    )
  }

  if (!report) return null

  const badge = statusLabels[report.status]

  return (
    <div className="app-page">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <p className="app-muted-text text-sm font-semibold uppercase">Direito de Recusa</p>
          <h1 className="app-title">Situação de risco</h1>
          <p className="text-sm app-muted-text">Aberto em {format(new Date(report.createdAt), 'dd/MM/yyyy HH:mm')}</p>
        </div>
        <span className={badge.color}>
          {badge.label}
        </span>
        <div className="ml-auto">
          <Link
            href="/dashboard/direito-de-recusa"
            className="text-sm font-semibold text-orange-500 hover:text-orange-400"
          >
            Voltar para lista
          </Link>
        </div>
      </div>

      {success ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="app-card space-y-3">
          <h2 className="text-lg font-semibold">Dados principais</h2>
          <InfoRow label="Colaborador" value={report.employeeName} />
          <InfoRow label="Setor / Contrato" value={report.sectorOrContract} />
          <InfoRow label="Situação de risco" value={report.riskSituation} />
          <InfoRow label="Local / Equipamento" value={report.locationOrEquipment} />
          <InfoRow label="Gestor do contrato " value={report.contractManagerName || 'Não informado'} />
          <InfoRow label="Coordenador / SST" value={report.generalCoordinatorName || 'Não informado'} />
        </div>

        <div className="app-card space-y-3">
          <h2 className="text-lg font-semibold">Descrição detalhada</h2>
          <p className="whitespace-pre-wrap text-sm app-muted-text">{report.detailedCondition}</p>
          <div>
            <h3 className="text-sm font-semibold">Anexos</h3>
            {report.attachments?.length ? (
              <ul className="mt-1 space-y-1 text-sm text-orange-400">
                {report.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {a.filename}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm app-muted-text">Nenhum anexo enviado.</p>
            )}
          </div>
        </div>
      </div>

      {report.status !== 'PENDENTE' ? (
        <div className="app-card space-y-2">
          <h2 className="text-lg font-semibold">Parecer</h2>
          <p className="text-sm app-muted-text">
            Situação {report.decision ? 'procede' : 'não procede'} ·{' '}
            {report.decidedAt ? format(new Date(report.decidedAt), 'dd/MM/yyyy HH:mm') : 'Data não informada'}
          </p>
          {report.decisionComment ? (
            <p className="text-sm app-muted-text whitespace-pre-wrap">{report.decisionComment}</p>
          ) : (
            <p className="text-sm app-muted-text">Sem comentários adicionais.</p>
          )}
        </div>
      ) : canReview ? (
        <div className="app-card space-y-4">
          <h2 className="text-lg font-semibold">Parecer do gestor / SST</h2>
          <div className="flex gap-3">
            <button
              type="button"
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                decision === 'SIM'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-[var(--border-subtle)] app-muted-text hover:border-emerald-400'
              }`}
              onClick={() => setDecision('SIM')}
            >
              <Check size={16} /> Situação procede
            </button>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                decision === 'NAO'
                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                  : 'border-[var(--border-subtle)] app-muted-text hover:border-rose-400'
              }`}
              onClick={() => setDecision('NAO')}
            >
              <X size={16} /> Não procede
            </button>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium app-muted-text">Comentário</label>
            <textarea
              className="app-textarea"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Descreva o parecer do gestor ou da equipe de SST"
            />
          </div>
          {error ? (
            <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitDecision}
              disabled={saving || !decision}
              className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : null}
              Registrar parecer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide app-muted-text">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}