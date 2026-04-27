'use client'
import * as React from 'react'
import ModulesPanel from './ModulesPanel'

const INPUT =
  'mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300'

export type CostCenterRow = {
  id: string
  description: string
  code?: string | null
  externalCode?: string | null
  abbreviation?: string | null
  area?: string | null
  managementType?: string | null
  groupName?: string | null
  status?: string | null // pode ser ATIVADO/INATIVO ou ACTIVE/INACTIVE dependendo do backend
  notes?: string | null
}

export default function EditarCentroDeCusto({
  row,
  onClose,
  onSaved,
}: {
  row: CostCenterRow
  onClose: () => void
  onSaved: () => void
}) {
  const [eDesc, setEDesc] = React.useState(row.description || '')
  const [eCode, setECode] = React.useState(row.code || '')
  const [eExternalCode, setEExternalCode] = React.useState(row.externalCode || '')
  const [eAbbreviation, setEAbbreviation] = React.useState(row.abbreviation || '')
  const [eArea, setEArea] = React.useState(row.area || '')
  const [eManagementType, setEManagementType] = React.useState(row.managementType || '')
  const [eGroupName, setEGroupName] = React.useState(row.groupName || '')
  // mantenho os valores do seu front; ajuste se o backend usa ACTIVE/INACTIVE
  const [eStatus, setEStatus] = React.useState<'ATIVADO' | 'INATIVO'>(
    ((row.status as any) || 'ATIVADO') as 'ATIVADO' | 'INATIVO',
  )
  const [eNotes, setENotes] = React.useState(row.notes || '')
  const [saving, setSaving] = React.useState(false)

  async function saveEdit() {
    setSaving(true)
    try {
      const r = await fetch(`/api/cost-centers/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: eDesc,
          code: eCode,
          externalCode: eExternalCode,
          abbreviation: eAbbreviation,
          area: eArea,
          managementType: eManagementType,
          groupName: eGroupName,
          status: eStatus, // ajuste no backend se necessário
          notes: eNotes,
        }),
      })
      if (!r.ok) {
        alert('Falha ao salvar')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-5xl rounded-2xl bg-[var(--card)] p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Editar centro de custo</h3>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-[var(--table-row-hover)]">
          ✕
        </button>
      </div>

      {/* 👇 AQUI entra a grid 12 colunas: formulário (8) + painel de módulos (4) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Coluna esquerda → formulário */}
        <div className="col-span-12 lg:col-span-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase">Descrição *</label>
              <input className={INPUT} value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase">Código</label>
              <input className={INPUT} value={eCode} onChange={(e) => setECode(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase">Código Externo</label>
              <input
                className={INPUT}
                value={eExternalCode}
                onChange={(e) => setEExternalCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase">Sigla</label>
              <input
                className={INPUT}
                value={eAbbreviation}
                onChange={(e) => setEAbbreviation(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase">Área</label>
              <input className={INPUT} value={eArea} onChange={(e) => setEArea(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase">Tipo de Gestão</label>
              <input
                className={INPUT}
                value={eManagementType}
                onChange={(e) => setEManagementType(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase">Grupo</label>
              <input
                className={INPUT}
                value={eGroupName}
                onChange={(e) => setEGroupName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase">Status</label>
              <select
                className={INPUT}
                value={eStatus}
                onChange={(e) => setEStatus(e.target.value as any)}
              >
                <option value="ATIVADO">ATIVADO</option>
                <option value="INATIVO">INATIVO</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase">Observações</label>
              <textarea
                className={INPUT}
                rows={3}
                value={eNotes}
                onChange={(e) => setENotes(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 mt-6 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-50"
                disabled={saving}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>

        {/* Coluna direita → painel de módulos */}
        <div className="col-span-12 lg:col-span-4">
          {/* row.id é o ID do centro de custo sendo editado */}
          <ModulesPanel costCenterId={row.id} />
        </div>
      </div>
    </div>
  )
}
