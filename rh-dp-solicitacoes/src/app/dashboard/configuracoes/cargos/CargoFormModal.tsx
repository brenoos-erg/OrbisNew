'use client'

import * as React from 'react'

const INPUT =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300'

export type PositionRow = {
  id?: string
  name: string
  description?: string | null
  departmentId?: string | null
  baseSalary?: string | number | null
  workLocation?: string | null
  workHours?: string | null
  requirements?: string | null
  activities?: string | null
}

export function CargoFormModal({
  row,
  onClose,
  onSaved,
}: {
  row?: PositionRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!row?.id

  const [name, setName] = React.useState(row?.name ?? '')
  const [description, setDescription] = React.useState(row?.description ?? '')
  const [workLocation, setWorkLocation] = React.useState(row?.workLocation ?? '')
  const [workHours, setWorkHours] = React.useState(row?.workHours ?? '')
  const [baseSalary, setBaseSalary] = React.useState(
    row?.baseSalary ? String(row.baseSalary) : '',
  )
  const [requirements, setRequirements] = React.useState(row?.requirements ?? '')
  const [activities, setActivities] = React.useState(row?.activities ?? '')
  const [saving, setSaving] = React.useState(false)

  async function handleSave() {
    if (!name.trim()) {
      alert('Nome do cargo é obrigatório.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        workLocation,
        workHours,
        baseSalary: baseSalary ? Number(baseSalary) : null,
        requirements,
        activities,
      }

      const url = row?.id ? `/api/positions/${row.id}` : '/api/positions'
      const method = row?.id ? 'PATCH' : 'POST'

      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err?.error || 'Falha ao salvar cargo.')
        return
      }

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Editar cargo' : 'Novo cargo'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Nome do cargo *
            </label>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Descrição / resumo
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Local de trabalho
            </label>
            <input
              className={INPUT}
              value={workLocation || ''}
              onChange={(e) => setWorkLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Horário de trabalho
            </label>
            <input
              className={INPUT}
              value={workHours || ''}
              onChange={(e) => setWorkHours(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Salário base (opcional)
            </label>
            <input
              className={INPUT}
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="Ex.: 3500.00"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Requisitos principais
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={requirements || ''}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Principais atividades
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={activities || ''}
              onChange={(e) => setActivities(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 mt-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
