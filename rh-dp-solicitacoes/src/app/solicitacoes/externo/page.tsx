'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type Campo = {
  name: string
  label: string
  type?: string
  required?: boolean
  options?: string[]
}

type Tipo = {
  id: string
  codigo: string
  nome: string
  camposEspecificos?: Campo[]
  meta?: { allowExternalAccess?: boolean }
}

const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 transition'

export default function SolicitacaoExternaPage() {
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [tipoId, setTipoId] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/tipos-solicitacao')
      const data = (await response.json()) as Tipo[]
      setTipos(
        data.filter(
          (tipo) => tipo.meta?.allowExternalAccess && ['RECLAMACOES_OUVIDORIA', 'FALE_CONOSCO'].includes(tipo.id),
        ),
      )
    }

    load()
  }, [])

  const selectedTipo = useMemo(() => tipos.find((item) => item.id === tipoId) ?? null, [tipos, tipoId])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTipo) return

    setSending(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('tipoId', selectedTipo.id)
    formData.append('campos', JSON.stringify(campos))
    files.forEach((file) => formData.append('files', file))

    const response = await fetch('/api/solicitacoes/externas', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()
    if (!response.ok) {
      setMessage(result.error ?? 'Erro ao enviar solicitação.')
      setSending(false)
      return
    }

    setMessage(`Solicitação enviada com sucesso. Protocolo: ${result.protocolo}`)
    setCampos({})
    setFiles([])
    setSending(false)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-800">Canal externo de solicitações</h1>
      <p className="mt-2 text-sm text-slate-600">Formulário para RECLAMAÇÕES (OUVIDORIA) e FALE CONOSCO.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo de solicitação</label>
          <select className={inputClass} value={tipoId} onChange={(e) => setTipoId(e.target.value)} required>
            <option value="">Selecione...</option>
            {tipos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>{`${tipo.codigo} - ${tipo.nome}`}</option>
            ))}
          </select>
        </div>

        {selectedTipo?.camposEspecificos?.map((campo) => {
          const fieldType = (campo.type ?? 'text').toLowerCase()

          if (fieldType === 'file') {
            return (
              <div key={campo.name}>
                <label className="mb-1 block text-xs font-semibold text-slate-600">{campo.label}</label>
                <input className={inputClass} type="file" multiple onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])} />
              </div>
            )
          }

          if (fieldType === 'textarea') {
            return (
              <div key={campo.name}>
                <label className="mb-1 block text-xs font-semibold text-slate-600">{campo.label}</label>
                <textarea
                  className={`${inputClass} min-h-[120px]`}
                  value={campos[campo.name] ?? ''}
                  required={campo.required}
                  onChange={(e) => setCampos((prev) => ({ ...prev, [campo.name]: e.target.value }))}
                />
              </div>
            )
          }

          return (
            <div key={campo.name}>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{campo.label}</label>
              <input
                className={inputClass}
                type={fieldType === 'date' ? 'date' : 'text'}
                value={campos[campo.name] ?? ''}
                required={campo.required}
                onChange={(e) => setCampos((prev) => ({ ...prev, [campo.name]: e.target.value }))}
              />
            </div>
          )
        })}

        <button
          type="submit"
          disabled={sending || !selectedTipo}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {sending ? 'Enviando...' : 'Enviar solicitação'}
        </button>

        {message && <p className="text-sm text-slate-700">{message}</p>}
      </form>
    </main>
  )
}