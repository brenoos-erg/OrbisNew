'use client'

import { useEffect, useMemo, useState } from 'react'

type UploadedFile = {
  id: string
  filename: string
  sizeBytes: number
  mimeType: string
  createdAt: string
  previewUrl: string
  downloadUrl: string
}

type ChecklistItem = {
  key: string
  label: string
  required: boolean
  group: 'geral' | 'casado' | 'filhos'
  maxFiles?: number
  status: 'PENDENTE' | 'ENVIADO' | 'ERRO'
  files: UploadedFile[]
}

type Payload = {
  protocolo: string
  candidateName: string
  status: string
  checklist: ChecklistItem[]
  checklistStatus: Record<string, boolean>
  canConclude: boolean
  requiredCount: number
  requiredDone: number
  allowedTypes: string[]
  maxFileSizeBytes: number
}

const GROUP_TITLES: Record<string, string> = {
  geral: 'Documentos gerais',
  casado: 'Documentos para candidato casado/união estável',
  filhos: 'Documentos para filhos/dependentes',
}

function prettyFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ExternalAdmissionTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('')
  const [payload, setPayload] = useState<Payload | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [concluding, setConcluding] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null)

  useEffect(() => {
    void params.then((p) => setToken(p.token))
  }, [params])

  async function load() {
    if (!token) return
    const res = await fetch(`/api/solicitacoes/externas/admissao/public/${token}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Link inválido.')
      return
    }
    setPayload(data)
    setError(null)
    if (data.status === 'ENVIADO_PELO_CANDIDATO') {
      setCompleted(true)
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  const groups = useMemo(() => {
    const grouped = {
      geral: [] as ChecklistItem[],
      casado: [] as ChecklistItem[],
      filhos: [] as ChecklistItem[],
    }
    if (!payload) return grouped

    payload.checklist.forEach((item) => {
      grouped[item.group]?.push(item)
    })

    return grouped
  }, [payload])

  const progressPercent = useMemo(() => {
    if (!payload || payload.requiredCount === 0) return 0
    return Math.min(100, Math.round((payload.requiredDone / payload.requiredCount) * 100))
  }, [payload])

  const requiredPending = useMemo(
    () => payload?.checklist.filter((item) => item.required && !payload.checklistStatus[item.key]) ?? [],
    [payload],
  )

  async function upload(itemKey: string, file: File | null) {
    if (!file || !token) return
    setUploadingKey(itemKey)
    setMessage(null)
    setError(null)

    const fd = new FormData()
    fd.append('itemKey', itemKey)
    fd.append('file', file)

    const res = await fetch(`/api/solicitacoes/externas/admissao/public/${token}`, {
      method: 'POST',
      body: fd,
    })

    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setError(body?.error ?? 'Falha ao enviar arquivo.')
      setUploadingKey(null)
      return
    }

    setMessage('Arquivo enviado com sucesso.')
    setUploadingKey(null)
    await load()
  }

  async function conclude() {
    if (!token || !payload) return
    if (!payload.canConclude) {
      setError(`Ainda faltam ${requiredPending.length} documento(s) obrigatório(s).`)
      return
    }

    setConcluding(true)
    setError(null)
    setMessage(null)
    const res = await fetch(`/api/solicitacoes/externas/admissao/public/${token}`, { method: 'PATCH' })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const pending = Array.isArray(body?.requiredPending) ? ` Pendentes: ${body.requiredPending.join(', ')}.` : ''
      setError((body?.error ?? 'Falha ao concluir envio.') + pending)
      setConcluding(false)
      return
    }
    setConcluding(false)
    setCompleted(true)
    await load()
  }

  if (error && !payload) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-red-700">{error}</main>
  }

  if (!payload) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-slate-600">Carregando checklist...</main>
  }

  if (completed) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-2xl font-semibold text-emerald-800">Documentos enviados com sucesso</h1>
          <p className="mt-2 text-sm text-emerald-900">O RH fará a conferência da sua documentação.</p>
          <p className="mt-2 text-sm text-emerald-900">Protocolo: <strong>{payload.protocolo}</strong></p>
          <p className="mt-2 text-sm text-emerald-900">Aguarde o contato do time de RH para próximos passos.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <header className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">RH | Portal de Solicitações</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Envio de documentos para admissão</h1>
        <p className="mt-2 text-sm text-slate-700">Olá, <strong>{payload.candidateName}</strong>. Siga os cartões abaixo e anexe seus documentos para concluir a admissão.</p>
        <p className="mt-2 text-sm text-slate-600">Protocolo: <strong>{payload.protocolo}</strong></p>
        <p className="mt-1 text-xs text-slate-500">Observação: o exame ASO não é exigido neste portal.</p>
      </header>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Progresso dos obrigatórios</h2>
          <span className="text-sm font-medium text-slate-700">{payload.requiredDone}/{payload.requiredCount} enviados</span>
        </div>
        <div className="mt-3 h-3 w-full rounded-full bg-slate-200">
          <div className="h-3 rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        {requiredPending.length > 0 ? (
          <p className="mt-2 text-xs text-amber-700">Faltam {requiredPending.length} documento(s) obrigatório(s).</p>
        ) : (
          <p className="mt-2 text-xs text-emerald-700">Todos os documentos obrigatórios foram enviados.</p>
        )}
      </section>

      {(['geral', 'casado', 'filhos'] as const).map((groupKey) => (
        <section key={groupKey} className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{GROUP_TITLES[groupKey]}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {groups[groupKey].map((item) => {
              const isUploading = uploadingKey === item.key
              const sent = item.files.length > 0
              return (
                <article key={item.key} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className={`rounded-full px-2 py-1 ${item.required ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                          {item.required ? 'Obrigatório' : 'Opcional'}
                        </span>
                        <span className={`rounded-full px-2 py-1 ${sent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {sent ? 'Enviado' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <label className="mt-4 block cursor-pointer rounded-lg border border-dashed border-slate-300 p-3 text-center text-sm text-slate-700 hover:bg-slate-50">
                    Selecionar arquivo
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => upload(item.key, e.target.files?.[0] ?? null)}
                      disabled={isUploading}
                    />
                  </label>
                  <p className="mt-1 text-xs text-slate-500">Formatos: {payload.allowedTypes.join(', ')} • Máx.: {Math.floor(payload.maxFileSizeBytes / (1024 * 1024))}MB</p>
                  {isUploading && <p className="mt-2 text-xs text-slate-500">Enviando arquivo...</p>}

                  <div className="mt-3 space-y-2">
                    {item.files.map((file) => (
                      <div key={file.id} className="rounded-lg border bg-slate-50 p-2 text-xs text-slate-700">
                        <p className="font-medium">{file.filename}</p>
                        <p>{prettyFileSize(file.sizeBytes)} • enviado em {new Date(file.createdAt).toLocaleString('pt-BR')}</p>
                        <div className="mt-1 flex gap-3">
                          <button type="button" className="text-blue-700 underline" onClick={() => setPreviewFile(file)}>Visualizar</button>
                          <a className="text-blue-700 underline" href={file.downloadUrl} target="_blank" rel="noreferrer">Baixar</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      <section className="sticky bottom-3 z-10 rounded-xl border bg-white p-4 shadow-lg">
        {requiredPending.length > 0 && (
          <p className="mb-2 text-sm text-amber-700">
            Pendentes obrigatórios: {requiredPending.map((item) => item.label).join(', ')}
          </p>
        )}
        <button
          type="button"
          disabled={!payload.canConclude || concluding}
          className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={conclude}
        >
          {concluding ? 'Concluindo envio...' : 'Concluir envio'}
        </button>
      </section>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {previewFile && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl rounded-xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Pré-visualização: {previewFile.filename}</h3>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setPreviewFile(null)}>Fechar</button>
            </div>
            {previewFile.mimeType.startsWith('image/') ? (
              <img src={previewFile.previewUrl} alt={previewFile.filename} className="max-h-[70vh] w-full rounded object-contain" />
            ) : (
              <iframe src={previewFile.previewUrl} title={previewFile.filename} className="h-[70vh] w-full rounded border" />
            )}
          </div>
        </div>
      )}
    </main>
  )
}
