'use client'

import { useEffect, useMemo, useState } from 'react'

type Department = {
  id: string
  code: string
  name: string
}

type CostCenter = {
  id: string
  code: string | null
  description: string
  departmentId: string | null
}

export default function DepartamentosCentrosDeCustoPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedCostCenterIds, setSelectedCostCenterIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/configuracoes/departamentos-centros-de-custo', {
        cache: 'no-store',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao carregar dados.')
      }

      const json = await res.json()
      const nextDepartments = (json?.departments ?? []) as Department[]
      const nextCostCenters = (json?.costCenters ?? []) as CostCenter[]

      setDepartments(nextDepartments)
      setCostCenters(nextCostCenters)

      const nextDepartmentId = selectedDepartmentId || nextDepartments[0]?.id || ''
      setSelectedDepartmentId(nextDepartmentId)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados.')
      setDepartments([])
      setCostCenters([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedDepartmentId) {
      setSelectedCostCenterIds([])
      return
    }

    setSelectedCostCenterIds(
      costCenters
        .filter((center) => center.departmentId === selectedDepartmentId)
        .map((center) => center.id),
    )
  }, [costCenters, selectedDepartmentId])

  const selectedDepartmentName = useMemo(
    () => departments.find((item) => item.id === selectedDepartmentId)?.name ?? '',
    [departments, selectedDepartmentId],
  )

  const toggleCostCenter = (id: string, checked: boolean) => {
    setSelectedCostCenterIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((item) => item !== id)
    })
  }

  const handleSave = async () => {
    if (!selectedDepartmentId) return

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/configuracoes/departamentos-centros-de-custo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDepartmentId,
          costCenterIds: selectedCostCenterIds,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao salvar vínculos.')
      }

      setSuccess('Vínculos salvos com sucesso.')
      await load()
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar vínculos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-slate-800">Departamentos x Centros de custo</h1>
        <p className="text-sm text-slate-600">
          Vincule múltiplos centros de custo para o mesmo departamento.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Departamento
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={selectedDepartmentId}
            onChange={(e) => {
              setSelectedDepartmentId(e.target.value)
              setSuccess(null)
            }}
            disabled={loading || departments.length === 0}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name} ({department.code})
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-sm font-medium text-slate-700">Centros de custo vinculados</p>
          <p className="text-xs text-slate-500">
            Tudo que os centros de custo receberem, quem for do departamento vai ver.
          </p>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {costCenters.map((center) => {
              const checked = selectedCostCenterIds.includes(center.id)
              return (
                <label
                  key={center.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleCostCenter(center.id, e.target.checked)}
                    disabled={!selectedDepartmentId || loading || saving}
                  />
                  <span>
                    {[center.code, center.description].filter(Boolean).join(' - ')}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Departamento selecionado: <strong>{selectedDepartmentName || '—'}</strong>
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedDepartmentId || saving || loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar vínculos'}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
      </section>
    </main>
  )
}