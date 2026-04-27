'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Paperclip, Upload } from 'lucide-react'

type FormState = {
  contractManagerId: string
  generalCoordinatorId: string
  sectorOrContract: string
  riskSituation: string
  locationOrEquipment: string
  detailedCondition: string
}

type ResponsibleOption = {
  id: string
  name: string
  email: string
  department: string | null
  level: 'NIVEL_2' | 'NIVEL_3'
}

export default function NewRefusalReportPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    contractManagerId: '',
    generalCoordinatorId: '',
    sectorOrContract: '',
    riskSituation: '',
    locationOrEquipment: '',
    detailedCondition: '',
  })
  const [responsibles, setResponsibles] = useState<ResponsibleOption[]>([])
  const [coordinators, setCoordinators] = useState<ResponsibleOption[]>([])
  const [responsiblesError, setResponsiblesError] = useState<string | null>(null)
  const [loadingResponsibles, setLoadingResponsibles] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isValid = useMemo(() => {
    return (
      form.contractManagerId.trim() &&
      form.generalCoordinatorId.trim() &&
      form.sectorOrContract.trim() &&
      form.riskSituation.trim() &&
      form.locationOrEquipment.trim() &&
      form.detailedCondition.trim()
    )
  }, [form])

    const contractManagers = useMemo(
    () => responsibles.filter((resp) => resp.level === 'NIVEL_2'),
    [responsibles],
  )
  const availableCoordinators = useMemo(
    () => coordinators.filter((resp) => resp.level === 'NIVEL_3'),
    [coordinators],
  )

  useEffect(() => {
    async function loadResponsibles() {
      try {
        setResponsiblesError(null)
        const res = await fetch('/api/direito-de-recusa/responsaveis', { cache: 'no-store' })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json?.error || 'Erro ao carregar responsáveis.')
        }
        const json = (await res.json()) as {
          contractManagers?: ResponsibleOption[]
          coordinators?: ResponsibleOption[]
        }
        setResponsibles(json.contractManagers ?? [])
        setCoordinators(json.coordinators ?? [])
      } catch (err: any) {
        setResponsiblesError(err?.message || 'Erro ao carregar responsáveis.')
      } finally {
        setLoadingResponsibles(false)
      }
    }

    loadResponsibles()
  }, [])

  function handleFileChange(ev: ChangeEvent<HTMLInputElement>) {
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
        body: JSON.stringify({
          contractManagerId: form.contractManagerId || null,
          generalCoordinatorId: form.generalCoordinatorId || null,
          sectorOrContract: form.sectorOrContract,
          riskSituation: form.riskSituation,
          locationOrEquipment: form.locationOrEquipment,
          detailedCondition: form.detailedCondition,
        }),
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
    <div className="app-page max-w-4xl">
      <div>
        <p className="app-muted-text text-sm font-semibold uppercase">Direito de Recusa</p>
        <h1 className="app-title">Registrar recusa de atividade</h1>
        <p className="app-subtitle">
           Informe a situação de risco observada e os responsáveis diretos. Gestor de contrato são todos que têm
          acesso nível 2 no módulo de direito de recusa. Coordenador geral são todos que têm nível 3 no módulo de
          direito de recusa.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {success}
        </div>
      ) : null}

       <form onSubmit={onSubmit} className="app-card space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="app-muted-text text-sm font-medium">Gestor do contrato</label>
            <select
              className="app-select"
              value={form.contractManagerId}
              onChange={(e) => setForm((prev) => ({ ...prev, contractManagerId: e.target.value }))}
              disabled={loadingResponsibles}
              required
            >
              <option value="">Selecione o gestor</option>
              {contractManagers.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.name}
                  {responsible.department ? ` — ${responsible.department}` : ''}
                </option>
              ))}
            </select>
            {loadingResponsibles ? (
              <p className="text-xs app-muted-text">Carregando responsáveis...</p>
            ) : null}
            {!loadingResponsibles && contractManagers.length === 0 ? (
              <p className="text-xs app-muted-text">
                Nenhum gestor de contrato (nível 2 no módulo de direito de recusa) disponível.
              </p>
            ) : null}
            {responsiblesError ? (
              <p className="text-xs text-rose-600">{responsiblesError}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="app-muted-text text-sm font-medium">Coordenador geral </label>
            <select
              className="app-select"
              value={form.generalCoordinatorId}
              onChange={(e) => setForm((prev) => ({ ...prev, generalCoordinatorId: e.target.value }))}
              disabled={loadingResponsibles}
            
              required
            >
              <option value="">Selecione o coordenador</option>
              {availableCoordinators.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.name}
                  {responsible.department ? ` — ${responsible.department}` : ''}
                </option>
              ))}
            </select>
            {!loadingResponsibles && availableCoordinators.length === 0 ? (
              <p className="text-xs app-muted-text">
                Nenhum coordenador geral (nível 3 no módulo de direito de recusa) disponível.
              </p>
            ) : null}
            {responsiblesError ? (
              <p className="text-xs text-rose-600">{responsiblesError}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="app-muted-text text-sm font-medium">Setor / Contrato *</label>
            <input
              className="app-input"
              required
              value={form.sectorOrContract}
              onChange={(e) => setForm((prev) => ({ ...prev, sectorOrContract: e.target.value }))}
              placeholder="Ex.: Obras - Contrato 123"
            />
          </div>
          <div className="space-y-1">
            <label className="app-muted-text text-sm font-medium">Situação de risco identificada *</label>
            <input
              className="app-input"
              required
              value={form.riskSituation}
              onChange={(e) => setForm((prev) => ({ ...prev, riskSituation: e.target.value }))}
              placeholder="Ex.: Trabalho em altura sem ancoragem"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="app-muted-text text-sm font-medium">Local e/ou equipamento *</label>
            <input
              className="app-input"
              required
              value={form.locationOrEquipment}
              onChange={(e) => setForm((prev) => ({ ...prev, locationOrEquipment: e.target.value }))}
              placeholder="Ex.: Plataforma elevatória - pátio 2"
            />
          </div>
          <div className="space-y-1">
            <label className="app-muted-text text-sm font-medium">Anexos (opcional)</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--input-border)] bg-[var(--input)] px-3 py-2 text-sm app-muted-text hover:border-orange-400 hover:bg-orange-500/10">
              <Upload size={16} />
              <span>Selecione arquivos (imagens ou PDF)</span>
              <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileChange} />
            </label>
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs app-muted-text">
                {files.map((file) => (
                  <span
                    key={file.name + file.size}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--table-row-hover)] px-2 py-1"
                  >
                    <Paperclip size={12} /> {file.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label className="app-muted-text text-sm font-medium">
            Descrição detalhada da condição de risco *
          </label>
          <textarea
            className="app-textarea"
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
            className="app-button-secondary"
            onClick={() => router.push('/dashboard/direito-de-recusa')}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !isValid}
            className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            Enviar para avaliação
          </button>
        </div>
      </form>
    </div>
  )
}
