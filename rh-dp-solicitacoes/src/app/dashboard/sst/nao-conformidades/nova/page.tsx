'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import GutRadarCard from '@/components/sst/GutRadarCard'
import { GUT_OPTIONS } from '@/lib/sst/gut'

type CostCenter = { id: string; description: string; code?: string | null }

export default function NovaNaoConformidadePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [centers, setCenters] = useState<CostCenter[]>([])
  const [gravidade, setGravidade] = useState(1)
  const [urgencia, setUrgencia] = useState(1)
  const [tendencia, setTendencia] = useState(1)

  useEffect(() => {
    fetch('/api/cost-centers/select').then((r) => r.json()).then(setCenters).catch(() => setCenters([]))
  }, [])

  const centerLabels = useMemo(
    () => Object.fromEntries(centers.map((x) => [x.id, `${x.code || '-'} - ${x.description}`])),
    [centers],
  )

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const payload = {
      descricao: form.get('descricao'),
      evidenciaObjetiva: form.get('evidenciaObjetiva'),
      centroQueDetectouId: form.get('centroQueDetectouId'),
      centroQueOriginouId: form.get('centroQueOriginouId'),
      tipoNc: form.get('tipoNc'),
      referenciaSig: form.get('referenciaSig'),
      acoesImediatas: form.get('acoesImediatas'),
      gravidade,
      urgencia,
      tendencia,
    }


    try {
      setSaving(true)
      setError(null)
      const res = await fetch('/api/sst/nao-conformidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao registrar não conformidade.')
      router.push(`/dashboard/sst/nao-conformidades/${data.id}`)
    } catch (err: any) {
      setError(err?.message || 'Falha ao registrar não conformidade.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase text-slate-500">Não Conformidades</p>
        <h1 className="text-2xl font-bold text-slate-900">Nova não conformidade</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldSelect name="tipoNc" label="Tipo NC" options={['AUDITORIA_CLIENTE', 'AUDITORIA_EXTERNA', 'AUDITORIA_INTERNA', 'OUTROS', 'PROCESSOS', 'NOTIFICACOES_CLIENTE']} />
            <FieldInput name="referenciaSig" label="Referência SIG" required={false} />
            <FieldSelect name="centroQueDetectouId" label="Centro que detectou" options={centers.map((x) => x.id)} labels={centerLabels} />
            <FieldSelect name="centroQueOriginouId" label="Centro que originou" options={centers.map((x) => x.id)} labels={centerLabels} />
            <FieldSelectNumeric label="Gravidade" value={gravidade} options={GUT_OPTIONS.gravidade} onChange={setGravidade} />
            <FieldSelectNumeric label="Urgência" value={urgencia} options={GUT_OPTIONS.urgencia} onChange={setUrgencia} />
            <FieldSelectNumeric label="Tendência" value={tendencia} options={GUT_OPTIONS.tendencia} onChange={setTendencia} />
          </div>

           <FieldTextarea name="descricao" label="Descrição" />
          <FieldTextarea name="evidenciaObjetiva" label="Evidência objetiva" />
          <FieldTextarea name="acoesImediatas" label="Ações imediatas" required={false} />

          {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => router.push('/dashboard/sst/nao-conformidades')} className="rounded-md border border-slate-200 px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>

        <GutRadarCard gravidade={gravidade} urgencia={urgencia} tendencia={tendencia} />
      </div>
    </div>
  )
}

function FieldInput({ label, name, type = 'text', required = true }: { label: string; name: string; type?: string; required?: boolean }) {
  return <label className="space-y-1 text-sm font-medium text-slate-700">{label}<input type={type} name={name} required={required} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal" /></label>
}
function FieldSelect({ label, name, options, labels = {} }: { label: string; name: string; options: string[]; labels?: Record<string, string> }) {
  return <label className="space-y-1 text-sm font-medium text-slate-700">{label}<select name={name} required className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal">{options.map((option)=><option key={option} value={option}>{labels[option] || option}</option>)}</select></label>
}
function FieldSelectNumeric({ label, value, options, onChange }: { label: string; value: number; options: ReadonlyArray<{ value: number; label: string }>; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1 text-sm font-medium text-slate-700">
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal">
        {options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}
function FieldTextarea({ label, name, required = true }: { label: string; name: string; required?: boolean }) {
  return <label className="space-y-1 text-sm font-medium text-slate-700">{label}<textarea name={name} required={required} rows={4} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal" /></label>
}