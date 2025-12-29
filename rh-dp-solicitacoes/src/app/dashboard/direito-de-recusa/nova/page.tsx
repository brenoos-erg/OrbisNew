'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Paperclip, Upload } from 'lucide-react'

type FormState = {
  contractManagerName: string
  generalCoordinatorName: string
  sectorOrContract: string
  riskSituation: string
  locationOrEquipment: string
  detailedCondition: string
}

export default function NewRefusalReportPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    contractManagerName: '',
    generalCoordinatorName: '',
    sectorOrContract: '',
    riskSituation: '',
    locationOrEquipment: '',
    detailedCondition: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isValid = useMemo(() => {
    return (
      form.sectorOrContract.trim() &&
      form.riskSituation.trim() &&
      form.locationOrEquipment.trim() &&
      form.detailedCondition.trim()
    )
  }, [form])

  function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(ev.target.files || [])
    setFiles(selected)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/direito-de-recusa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Erro ao registrar o direito de recusa.')
      }

      const { id } = (await res.json()) as { id: string }

      if (files.length > 0) {
        const fd = new FormData()
        files.forEach((file) => fd.append('files', file))
        const upload = await fetch(`/api/direito-de-recusa/${id}/anexos`, {
          method: 'POST',
          body: fd,
        })
        if (!upload.ok) {
          const json = await upload.json().catch(() => ({}))
          throw new Error(json?.error || 'Erro ao enviar anexos.')
        }
      }

      setSuccess('Registro enviado com sucesso.')
      router.push(`/dashboard/direito-de-recusa/${id}`)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase text-slate-500">Direito de Recusa</p>
        <h1 className="text-2xl font-bold text-slate-900">Registrar recusa de atividade</h1>
        <p className="text-slate-600">
          Informe a situação de risco observada e os responsáveis diretos. Enviaremos para avaliação do gestor do
          contrato (Nível 2) ou equipe de SST (Nível 3).
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Gestor do contrato (Nível 2)</label>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={form.contractManagerName}
              onChange={(e) => setForm((prev) => ({ ...prev, contractManagerName: e.target.value }))}
              placeholder="Nome completo do gestor"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Coordenador geral (Nível 3)</label>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={form.generalCoordinatorName}
              onChange={(e) => setForm((prev) => ({ ...prev, generalCoordinatorName: e.target.value }))}
              placeholder="Nome do coordenador ou equipe de SST"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Setor / Contrato *</label>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
              value={form.sectorOrContract}
              onChange={(e) => setForm((prev) => ({ ...prev, sectorOrContract: e.target.value }))}
              placeholder="Ex.: Obras - Contrato 123"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Situação de risco identificada *</label>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
              value={form.riskSituation}
              onChange={(e) => setForm((prev) => ({ ...prev, riskSituation: e.target.value }))}
              placeholder="Ex.: Trabalho em altura sem ancoragem"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Local e/ou equipamento *</label>
            <input
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
              value={form.locationOrEquipment}
              onChange={(e) => setForm((prev) => ({ ...prev, locationOrEquipment: e.target.value }))}
              placeholder="Ex.: Plataforma elevatória - pátio 2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Anexos (opcional)</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-orange-300 hover:bg-orange-50">
              <Upload size={16} />
              <span>Selecione arquivos (imagens ou PDF)</span>
              <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileChange} />
            </label>
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {files.map((file) => (
                  <span
                    key={file.name + file.size}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"
                  >
                    <Paperclip size={12} /> {file.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Descrição detalhada da condição de risco *
          </label>
          <textarea
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            rows={5}
            required
            value={form.detailedCondition}
            onChange={(e) => setForm((prev) => ({ ...prev, detailedCondition: e.target.value }))}
            placeholder="Descreva o que foi observado, quem estava envolvido e por que a atividade foi recusada."
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => router.push('/dashboard/direito-de-recusa')}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !isValid}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            Enviar para avaliação
          </button>
        </div>
      </form>
    </div>
  )
}
