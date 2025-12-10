'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, Edit3, Trash2, List } from 'lucide-react'

type CostCenterOption = {
  id: string
  code: string | null
  description: string | null
  externalCode?: string | null
}

type ApiVehicle = {
  id: string
  plate: string
  type: string
  model?: string | null
  sector?: string | null
  kmCurrent?: number | null
  status?: string | null
  createdAt?: string | null
  costCenters?: Array<{
    costCenter: {
      id: string
      code?: string | null
      externalCode?: string | null
      description?: string | null
    } | null
  }>
}

type VehicleCheckin = {
  id: string
  inspectionDate: string
  costCenter?: string | null
  sectorActivity?: string | null
  kmAtInspection: number
  driverName?: string | null
  driverStatus: string
  vehicleStatus?: string
}

type VehicleStatusInfo = {
  label: string
  colorClass: string
  normalized: string
}

function getStatusInfo(status?: string | null): VehicleStatusInfo {
  const normalized = status?.toUpperCase() ?? 'DESCONHECIDO'

  switch (normalized) {
    case 'DISPONIVEL':
      return { label: 'Disponível', colorClass: 'bg-green-100 text-green-800', normalized }
    case 'RESTRITO':
      return { label: 'Restrito', colorClass: 'bg-red-100 text-red-800', normalized }
    case 'EM_USO':
      return { label: 'Em uso', colorClass: 'bg-blue-100 text-blue-800', normalized }
    case 'EM_MANUTENCAO':
      return { label: 'Em manutenção', colorClass: 'bg-amber-100 text-amber-800', normalized }
    case 'RESERVADO':
      return { label: 'Reservado', colorClass: 'bg-violet-100 text-violet-800', normalized }
    default:
      return { label: status ?? '—', colorClass: 'bg-slate-100 text-slate-800', normalized }
  }
}

function formatKm(km?: number | null) {
  if (typeof km !== 'number') return '—'
  return `${km.toLocaleString('pt-BR')} km`
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('pt-BR')
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<ApiVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingVehicle, setEditingVehicle] = useState<ApiVehicle | null>(null)

  const [selectedVehicle, setSelectedVehicle] = useState<ApiVehicle | null>(null)
  const [checkins, setCheckins] = useState<VehicleCheckin[]>([])
  const [loadingCheckins, setLoadingCheckins] = useState(false)

  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [loadingCostCenters, setLoadingCostCenters] = useState(false)

  const [formValues, setFormValues] = useState({
    plate: '',
    type: '',
    model: '',
    sector: '',
    kmCurrent: '',
    costCenterIds: [] as string[],
  })

  const plateRegex = /^[A-Z]{3}\d[A-Z]\d{2}$/ // Mercosul
  const normalizedPlate = formValues.plate.trim().toUpperCase()
  const isPlateValid = plateRegex.test(normalizedPlate)

  const restrictedVehicles = useMemo(
    () => vehicles.filter((vehicle) => getStatusInfo(vehicle.status).normalized === 'RESTRITO'),
    [vehicles]
  )

  useEffect(() => {
    loadVehicles()
    loadCostCenters()
  }, [])

  useEffect(() => {
    if (selectedVehicle) {
      loadCheckins(selectedVehicle.id)
    }
  }, [selectedVehicle])

  async function loadCostCenters() {
    setLoadingCostCenters(true)
    try {
      const res = await fetch('/api/cost-centers/select', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao buscar centros de custo')
      const data: CostCenterOption[] = await res.json()
      setCostCenters(data)
    } catch (err) {
      console.error(err)
      setCostCenters([])
    } finally {
      setLoadingCostCenters(false)
    }
  }

  async function loadVehicles() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/fleet/vehicles', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao buscar veículos')

      const data: ApiVehicle[] = await res.json()
      setVehicles(data)
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar os veículos cadastrados.')
      setVehicles([])
    } finally {
      setLoading(false)
    }
  }

  async function loadCheckins(vehicleId: string) {
    setLoadingCheckins(true)

    try {
      const res = await fetch(`/api/fleet/checkins?vehicleId=${vehicleId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao buscar check-ins')

      const data: Array<VehicleCheckin & { vehicleStatus?: string }> = await res.json()
      setCheckins(
        data.map((item) => ({
          ...item,
          vehicleStatus: (item as any).vehicle?.status || item.vehicleStatus,
        }))
      )
    } catch (err) {
      console.error(err)
      setCheckins([])
    } finally {
      setLoadingCheckins(false)
    }
  }

  function openCreateForm() {
    setEditingVehicle(null)
    setFormValues({
      plate: '',
      type: '',
      model: '',
      sector: '',
      kmCurrent: '',
      costCenterIds: [],
    })
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(vehicle: ApiVehicle) {
    setEditingVehicle(vehicle)
    setFormValues({
      plate: vehicle.plate,
      type: vehicle.type,
      model: vehicle.model || '',
      sector: vehicle.sector || '',
      kmCurrent: vehicle.kmCurrent?.toString() || '',
      costCenterIds:
        vehicle.costCenters
          ?.map((link) => link.costCenter?.id || null)
          .filter((id): id is string => Boolean(id)) || [],
    })
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setFormError(null)

    if (!isPlateValid) {
      setFormError('Informe uma placa no formato ABC1A34 (padrão Mercosul)')
      setSubmitting(false)
      return
    }

    const payload = {
      plate: normalizedPlate,
      type: formValues.type,
      model: formValues.model || undefined,
      sector: formValues.sector || undefined,
      kmCurrent: formValues.kmCurrent ? Number(formValues.kmCurrent) : undefined,
      costCenterIds: formValues.costCenterIds,
    }

    try {
      if (editingVehicle) {
        const res = await fetch(`/api/fleet/vehicles?id=${editingVehicle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error('Falha ao atualizar veículo')
      } else {
        const res = await fetch('/api/fleet/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Falha ao criar veículo')
        }
      }

      await loadVehicles()
      setFormOpen(false)
    } catch (err: any) {
      console.error(err)
      setFormError(err.message || 'Erro ao salvar veículo')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(vehicle: ApiVehicle) {
    const confirmed = window.confirm(`Deseja excluir o veículo ${vehicle.plate}?`)
    if (!confirmed) return

    try {
      const res = await fetch(`/api/fleet/vehicles?id=${vehicle.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Falha ao excluir veículo')

      if (selectedVehicle?.id === vehicle.id) {
        setSelectedVehicle(null)
        setCheckins([])
      }

      await loadVehicles()
    } catch (err) {
      console.error(err)
      alert('Não foi possível excluir o veículo.')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Veículos</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Visualize as informações dos veículos já cadastrados. O status é atualizado automaticamente conforme os
          check-ins realizados pela equipe.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={loadVehicles}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Recarregar lista
        </button>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
        >
          <Plus size={16} /> Registrar veículo
        </button>
        <a
          href="/api/fleet/checkins/excel"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-slate-800 hover:bg-slate-50"
        >
          <List size={16} /> Baixar Excel principal
        </a>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {restrictedVehicles.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {restrictedVehicles.length} veículo(s) estão restritos por conta de algum check-in recente.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Placa
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Modelo
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Centros de custo
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                KM atual
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-600">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Carregando veículos...
                  </div>
                </td>
              </tr>
            )}

            {!loading && vehicles.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-600">
                  Nenhum veículo cadastrado até o momento.
                </td>
              </tr>
            )}

            {!loading &&
              vehicles.map((vehicle) => {
                const vehicleCostCenters =
                  vehicle.costCenters
                    ?.map((link) => {
                      const cc = link.costCenter
                      if (!cc) return null
                      return cc.description || cc.code || cc.externalCode || null
                    })
                    .filter(Boolean) || []

                const vehicleCostCentersText =
                  vehicleCostCenters.length > 0 ? (vehicleCostCenters as string[]).join(', ') : '—'

                return (
                  <tr key={vehicle.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{vehicle.plate}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.type || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.model || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicleCostCentersText}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{formatKm(vehicle.kmCurrent)}</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-700">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedVehicle(vehicle)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50"
                        >
                          <List size={14} /> Check-ins
                        </button>
                        <button
                          onClick={() => openEditForm(vehicle)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50"
                        >
                          <Edit3 size={14} /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* painel de check-ins do veículo selecionado (se quiser tirar, pode remover tudo isso) */}
      {selectedVehicle && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-slate-500">Check-ins do veículo</p>
              <h2 className="text-2xl font-bold text-slate-900">{selectedVehicle.plate}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadCheckins(selectedVehicle.id)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <RefreshCw size={14} /> Atualizar
              </button>
              <a
                href={`/api/fleet/checkins/excel?vehicleId=${selectedVehicle.id}`}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
              >
                <List size={14} /> Excel deste veículo
              </a>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Data</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Motorista</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">KM</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Centro de custo</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Setor</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Status veículo</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Status motorista</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loadingCheckins && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-slate-600">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Carregando check-ins...
                      </div>
                    </td>
                  </tr>
                )}

                {!loadingCheckins && checkins.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-slate-600">
                      Nenhum check-in encontrado para este veículo.
                    </td>
                  </tr>
                )}

                {!loadingCheckins &&
                  checkins.map((checkin) => (
                    <tr key={checkin.id}>
                      <td className="px-4 py-2 text-slate-800">{formatDate(checkin.inspectionDate)}</td>
                      <td className="px-4 py-2 text-slate-800">{checkin.driverName || '—'}</td>
                      <td className="px-4 py-2 text-slate-800">{formatKm(checkin.kmAtInspection)}</td>
                      <td className="px-4 py-2 text-slate-800">{checkin.costCenter || '—'}</td>
                      <td className="px-4 py-2 text-slate-800">{checkin.sectorActivity || '—'}</td>
                      <td className="px-4 py-2 text-slate-800">{checkin.vehicleStatus || '—'}</td>
                      <td className="px-4 py-2 text-slate-800">{checkin.driverStatus}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {editingVehicle ? 'Editar' : 'Cadastrar'} veículo
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingVehicle ? editingVehicle.plate : 'Novo veículo'}
                </h2>
              </div>
              <button
                onClick={() => setFormOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1 text-sm text-slate-700">
                <span>Placa*</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.plate}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      plate: e.target.value,
                    }))
                  }
                  placeholder="ABC1A34"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>Tipo*</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.type}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      type: e.target.value,
                    }))
                  }
                  placeholder="Ex.: SUV"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>Modelo</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.model}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      model: e.target.value,
                    }))
                  }
                  placeholder="Ex.: Toro"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>Setor</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.sector}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      sector: e.target.value,
                    }))
                  }
                />
              </label>

              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Centros de custo</span>
                  {loadingCostCenters && <Loader2 size={14} className="animate-spin text-slate-500" />}
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                  {costCenters.length === 0 && !loadingCostCenters && (
                    <p className="text-xs text-slate-500">Nenhum centro de custo disponível.</p>
                  )}
                  {costCenters.map((cc) => {
                    const label =
                      cc.description || cc.code || cc.externalCode || 'Centro de custo'

                    return (
                      <label key={cc.id} className="flex items-center gap-2 text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={formValues.costCenterIds.includes(cc.id)}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setFormValues((prev) => ({
                              ...prev,
                              costCenterIds: checked
                                ? [...prev.costCenterIds, cc.id]
                                : prev.costCenterIds.filter((id) => id !== cc.id),
                            }))
                          }}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <label className="space-y-1 text-sm text-slate-700">
                <span>KM atual</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\\d*"
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.kmCurrent}
                  onChange={(e) => {
                    const onlyNumbers = e.target.value.replace(/\D/g, '')
                    setFormValues((prev) => ({ ...prev, kmCurrent: onlyNumbers }))
                  }}
                />
              </label>
            </div>

            {formError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {editingVehicle ? 'Salvar alterações' : 'Cadastrar veículo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
