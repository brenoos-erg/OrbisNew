'use client'
import { useEffect, useState } from 'react'

type Module = { id: string; key: string; name: string }

export default function ModulesPanel({ costCenterId }: { costCenterId: string }) {
  const [allModules, setAllModules] = useState<Module[]>([])
  const [enabled, setEnabled] = useState<Module[]>([])
  const [selectKey, setSelectKey] = useState('')

  async function load() {
    const [allR, enR] = await Promise.all([
      fetch('/api/modules', { cache: 'no-store' }),
      fetch(`/api/configuracoes/centros-de-custo/${costCenterId}/modules`, { cache: 'no-store' }),
    ])
    setAllModules(await allR.json())
    setEnabled(await enR.json())
  }

  async function add() {
    if (!selectKey) return
    await fetch(`/api/configuracoes/centros-de-custo/${costCenterId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleKey: selectKey }),
    })
    setSelectKey('')
    await load()
  }

  async function remove(key: string) {
    await fetch(
      `/api/configuracoes/centros-de-custo/${costCenterId}/modules?moduleKey=${encodeURIComponent(
        key,
      )}`,
      { method: 'DELETE' },
    )
    await load()
  }

  useEffect(() => {
    if (costCenterId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costCenterId])

  const available = allModules.filter((m) => !enabled.find((e) => e.id === m.id))

  return (
    <div className="border rounded-lg p-3 bg-white/70">
      <div className="font-semibold mb-2">Módulos do Centro de Custo</div>

      <div className="flex gap-2 mb-3">
        <select
          className="border rounded px-3 py-2 text-sm flex-1"
          value={selectKey}
          onChange={(e) => setSelectKey(e.target.value)}
        >
          <option value="">Selecionar módulo…</option>
          {available.map((m) => (
            <option key={m.id} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          className="border px-3 py-2 rounded text-sm hover:bg-slate-50 disabled:opacity-50"
          disabled={!selectKey}
        >
          Adicionar
        </button>
      </div>

      {enabled.length === 0 ? (
        <div className="text-sm text-slate-500">Nenhum módulo vinculado a este centro de custo.</div>
      ) : (
        <ul className="space-y-2">
          {enabled.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between border rounded px-3 py-2 bg-white"
            >
              <div className="text-sm">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-slate-500">{m.key}</div>
              </div>
              <button
                onClick={() => remove(m.key)}
                className="text-red-600 border px-2 py-1 rounded text-sm hover:bg-slate-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
