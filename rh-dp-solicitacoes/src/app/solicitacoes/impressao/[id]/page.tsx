'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type GenericRecord = Record<string, unknown>
type SpecificFieldSchema = { name?: string; label?: string }

type KeyValueItem = {
  key: string
  label: string
  value: string
}

const STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  AGUARDANDO_TERMO: 'Aguardando termo',
  AGUARDANDO_AVALIACAO_GESTOR: 'Aguardando avaliação do gestor',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

const TECHNICAL_KEY_PATTERNS = [
  /^id$/i,
  /uuid/i,
  /token/i,
  /hash/i,
  /debug/i,
  /payload/i,
  /auditoria/i,
  /audit/i,
  /timeline/i,
  /log/i,
  /metadata/i,
  /serializ/i,
  /intern/i,
  /raw/i,
  /json/i,
  /schema/i,
  /actor/i,
  /approverid/i,
  /solicitanteid/i,
  /workflow/i,
  /evento/i,
]

function formatStatus(value?: string | null) {
  if (!value) return '—'
  return STATUS_LABELS[value] ?? value
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR')
}

function formatDateOnly(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

function formatBytes(value?: number | null) {
  if (!value || value <= 0) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function prettifyKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function normalizeScalar(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''

  if (Array.isArray(value)) {
    const values = value
      .map((item) => normalizeScalar(item))
      .filter(Boolean)
    return values.join(', ')
  }

  if (typeof value === 'object') {
    const obj = value as GenericRecord
    if (typeof obj.label === 'string' && obj.label.trim()) return obj.label.trim()
    if (typeof obj.nome === 'string' && obj.nome.trim()) return obj.nome.trim()
    if (typeof obj.name === 'string' && obj.name.trim()) return obj.name.trim()
    if (typeof obj.descricao === 'string' && obj.descricao.trim()) return obj.descricao.trim()
    return ''
  }

  return ''
}

function isTechnicalKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return TECHNICAL_KEY_PATTERNS.some((pattern) => pattern.test(normalized))
}

function extractSpecificFields(
  payloadCampos: GenericRecord,
  schemaFields: SpecificFieldSchema[],
): KeyValueItem[] {
  const schemaByName = new Map<string, string>()
  schemaFields.forEach((field) => {
    const name = typeof field.name === 'string' ? field.name.trim() : ''
    if (!name) return
    const label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : prettifyKey(name)
    schemaByName.set(name, label)
  })

  const knownFields = Array.from(schemaByName.entries())
    .map(([name, label]) => ({ key: name, label, value: normalizeScalar(payloadCampos[name]) }))
    .filter((item) => item.value)

  const dynamicFields = Object.entries(payloadCampos)
    .filter(([key]) => !schemaByName.has(key))
    .filter(([key]) => !isTechnicalKey(key))
    .map(([key, value]) => ({ key, label: prettifyKey(key), value: normalizeScalar(value) }))
    .filter((item) => item.value)

  return [...knownFields, ...dynamicFields]
}

export default function PrintSolicitationPage() {
  const params = useParams<{ id: string }>()
  const solicitationId = params?.id

  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!solicitationId) return
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/solicitacoes/${solicitationId}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) throw new Error(json?.error ?? 'Erro ao carregar dados para impressão.')
        if (!mounted) return

        setDetail(json)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'Erro ao gerar a visualização de impressão.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [solicitationId])

  useEffect(() => {
    if (!detail || loading || error) return
    const timeout = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timeout)
  }, [detail, loading, error])

  const payload = (detail?.payload ?? {}) as GenericRecord
  const payloadCampos = ((payload.campos ?? {}) as GenericRecord) ?? {}
  const camposSchema = ((detail?.tipo?.schemaJson?.camposEspecificos ?? []) as SpecificFieldSchema[]) ?? []

  const mainSpecificFields = useMemo(
    () => extractSpecificFields(payloadCampos, camposSchema),
    [payloadCampos, camposSchema],
  )

  const requesterName = detail?.payload?.solicitante?.fullName ?? '—'
  const collaboratorName =
    detail?.payload?.solicitanteManual?.fullName ??
    detail?.payload?.colaboradorNome ??
    detail?.payload?.campos?.nomeColaborador ??
    '—'

  const comments = (detail?.comentarios ?? []).filter((item: any) => {
    const text = typeof item?.texto === 'string' ? item.texto.trim() : ''
    return Boolean(text)
  })

  if (loading) return <div className="p-6 text-sm text-slate-600">Carregando visualização de impressão...</div>
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>

  return (
    <main className="print-sheet mx-auto my-6 max-w-4xl bg-white p-8 text-slate-900 print:my-0 print:max-w-none print:p-0">
      <style jsx global>{`
        body {
          background: #f3f4f6;
          color: #0f172a;
        }

        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body {
            background: #fff !important;
          }

          .print-sheet {
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }

          .no-print {
            display: none !important;
          }

          .print-card {
            border-color: #e2e8f0 !important;
            break-inside: avoid;
          }
        }
      `}</style>

      <header className="mb-6 border-b-2 border-slate-900 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Solicitação</h1>
        <p className="mt-1 text-sm text-slate-600">Documento resumido para uso operacional</p>
      </header>

      <section className="print-card mb-5 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Cabeçalho da solicitação</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <p><strong>Número/código:</strong> {detail?.protocolo ?? '—'}</p>
          <p><strong>Tipo:</strong> {detail?.tipo?.nome ?? detail?.titulo ?? '—'}</p>
          <p><strong>Status:</strong> {formatStatus(detail?.status)}</p>
          <p><strong>Data:</strong> {formatDateTime(detail?.dataAbertura)}</p>
        </div>
      </section>

      <section className="print-card mb-5 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dados principais</h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          <p><strong>Solicitante:</strong> {requesterName}</p>
          <p><strong>Colaborador:</strong> {collaboratorName}</p>
          <p><strong>Centro de custo:</strong> {detail?.costCenter?.description ?? detail?.payload?.solicitante?.costCenterText ?? '—'}</p>
          <p><strong>Departamento:</strong> {detail?.department?.name ?? '—'}</p>
          <p><strong>Data de fechamento:</strong> {formatDateTime(detail?.dataFechamento)}</p>
        </div>
      </section>

      <section className="print-card mb-5 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dados específicos do chamado</h2>
        {mainSpecificFields.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum campo específico preenchido.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {mainSpecificFields.map((item) => (
              <p key={item.key}>
                <strong>{item.label}:</strong> {item.value}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="print-card mb-5 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Observações</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">Sem observações registradas.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {comments.map((comment: any) => (
              <li key={comment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="font-medium text-slate-800">{comment?.autor?.fullName ?? 'Sistema'}</p>
                <p className="text-slate-700">{comment?.texto ?? '—'}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(comment?.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="print-card mb-5 rounded-xl border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Atendimento / resposta</h2>
        <p className="text-sm">
          <strong>Status atual:</strong> {formatStatus(detail?.status)}
        </p>
        <p className="text-sm">
          <strong>Última atualização:</strong> {formatDateOnly(detail?.dataFechamento ?? detail?.dataAbertura)}
        </p>
      </section>

      {(detail?.anexos ?? []).length > 0 && (
        <section className="print-card rounded-xl border border-slate-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Anexos</h2>
          <ul className="space-y-1 text-sm">
            {(detail?.anexos ?? []).map((file: any) => (
              <li key={file.id}>
                • {file.filename} {file?.sizeBytes ? `(${formatBytes(file.sizeBytes)})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}