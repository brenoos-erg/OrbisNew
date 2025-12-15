'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, Edit3, Trash2, List, X, Maximize2, Minimize2 } from 'lucide-react'
import { isValidPlate } from '@/lib/plate'

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
  driver?: { fullName?: string | null; email?: string | null } | null
  driverStatus: string
  vehicleStatus?: string
  vehiclePlateSnapshot?: string | null
  vehicleTypeSnapshot?: string | null
  fatigueScore?: number | null
  fatigueRisk?: string | null
  hasNonConformity?: boolean
  nonConformityCriticality?: string | null
  nonConformityActions?: string | null
  nonConformityManager?: string | null
  nonConformityDate?: string | null
  checklistJson?: Array<{ name?: string; label?: string; category?: string; status?: string }>
  fatigueJson?: Array<{ name?: string; label?: string; answer?: string }>
}

type VehicleStatusInfo = {
  label: string
  colorClass: string
  normalized: string
}

type VehicleStatusLog = {
  id: string
  vehicleId: string
  status: string
  reason: string
  createdAt: string
  createdBy?: { fullName?: string | null; email?: string | null } | null
}

type FleetLevel = 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3'

const statusOptions = [
  { value: 'DISPONIVEL', label: 'Disponível' },
  { value: 'EM_USO', label: 'Em uso' },
  { value: 'RESERVADO', label: 'Reservado' },
  { value: 'EM_MANUTENCAO', label: 'Em manutenção' },
  { value: 'RESTRITO', label: 'Restrito' },
]

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

function getDriverStatusInfo(status?: string | null) {
  const normalized = status?.toUpperCase()

  if (normalized === 'INAPTO') {
    return { label: 'Inapto', colorClass: 'bg-red-100 text-red-800 border border-red-200' }
  }
  if (normalized === 'APTO') {
    return { label: 'Apto', colorClass: 'bg-green-100 text-green-800 border border-green-200' }
  }

  return { label: status || '—', colorClass: 'bg-slate-100 text-slate-700 border border-slate-200' }
}

function extractDriverNames(checkin: VehicleCheckin) {
  const rawNames = checkin.driverName || checkin.driver?.fullName || ''

  return rawNames
    .split(/[;,/]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
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

function formatDateTime(date?: string | null) {
  if (!date) return '—'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('pt-BR')
}

function getMonthBoundaries(month?: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { start: '', end: '' }

  const [year, monthIndex] = month.split('-').map(Number)
  const startDate = new Date(year, monthIndex - 1, 1)
  const endDate = new Date(year, monthIndex, 0)

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  }
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
  const [checkinsCollapsed, setCheckinsCollapsed] = useState(false)

  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [loadingCostCenters, setLoadingCostCenters] = useState(false)

  const [statusModalVehicle, setStatusModalVehicle] = useState<ApiVehicle | null>(null)
  const [statusSelection, setStatusSelection] = useState('DISPONIVEL')
  const [statusReason, setStatusReason] = useState('')
  const [statusLogs, setStatusLogs] = useState<VehicleStatusLog[]>([])
  const [loadingStatusLogs, setLoadingStatusLogs] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [viewingLogId, setViewingLogId] = useState<string | null>(null)
  const [typedReasonBackup, setTypedReasonBackup] = useState('')

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [fleetLevel, setFleetLevel] = useState<FleetLevel | null>(null)
  const [permissionsLoading, setPermissionsLoading] = useState(true)

  const [formValues, setFormValues] = useState({
    plate: '',
    type: '',
    model: '',
    sector: '',
    kmCurrent: '',
    costCenterIds: [] as string[],
  })

  const normalizedPlate = formValues.plate.trim().toUpperCase()
  const isPlateValid = isValidPlate(normalizedPlate)
  const canManageVehicles = fleetLevel === 'NIVEL_3'
  const canViewVehicles = fleetLevel === 'NIVEL_2' || canManageVehicles

  const restrictedVehicles = useMemo(
    () => vehicles.filter((vehicle) => getStatusInfo(vehicle.status).normalized === 'RESTRITO'),
    [vehicles],
  )

  const monthBoundaries = useMemo(() => getMonthBoundaries(selectedMonth), [selectedMonth])

  const appliedStartDate = customStartDate || monthBoundaries.start
  const appliedEndDate = customEndDate || monthBoundaries.end

  useEffect(() => {
    async function loadPermissions() {
      try {
        const res = await fetch('/api/session/me', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar permissões do módulo')

        const data = await res.json()
        const level: FleetLevel | null = (() => {
          const raw =
            data?.appUser?.moduleLevels?.['gestao-de-frotas'] ||
            data?.appUser?.moduleLevels?.['gestao_frotas']
          return raw === 'NIVEL_1' || raw === 'NIVEL_2' || raw === 'NIVEL_3' ? raw : null
        })()

        setFleetLevel(level)
      } catch (err) {
        console.error(err)
        setFleetLevel(null)
      } finally {
        setPermissionsLoading(false)
      }
    }

    loadPermissions()
  }, [])

  useEffect(() => {
    if (permissionsLoading) return

    if (!canViewVehicles) {
      setLoading(false)
      setLoadingCostCenters(false)
      return
    }

    loadVehicles()
    loadCostCenters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading, canViewVehicles])

  useEffect(() => {
    if (selectedVehicle) loadCheckins(selectedVehicle.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle])

  const filteredCheckins = useMemo(() => {
    const start = appliedStartDate ? new Date(`${appliedStartDate}T00:00:00`) : null
    const end = appliedEndDate ? new Date(`${appliedEndDate}T23:59:59`) : null

    return checkins.filter((checkin) => {
      if (!start && !end) return true
      const date = new Date(checkin.inspectionDate)
      if (Number.isNaN(date.getTime())) return false
      if (start && date < start) return false
      if (end && date > end) return false
      return true
    })
  }, [appliedEndDate, appliedStartDate, checkins])

  const monthlyDocUrl = useMemo(() => {
    if (!selectedVehicle) return '#'

    const params = new URLSearchParams({ vehicleId: selectedVehicle.id })
    const usingCustomDates = Boolean(customStartDate || customEndDate)

    if (usingCustomDates) {
      if (customStartDate) params.set('startDate', customStartDate)
      if (customEndDate) params.set('endDate', customEndDate)
    } else {
      if (selectedMonth) params.set('month', selectedMonth)
    }

    return `/api/fleet/checkins/monthly-sheet?${params.toString()}`
  }, [customEndDate, customStartDate, selectedMonth, selectedVehicle])

  const appliedPeriodLabel = useMemo(() => {
    if (appliedStartDate || appliedEndDate) return `${appliedStartDate || '...'} até ${appliedEndDate || '...'}`
    if (selectedMonth) return `Mês ${selectedMonth}`
    return 'Todos os check-ins'
  }, [appliedEndDate, appliedStartDate, selectedMonth])

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
    if (!canViewVehicles) return
    setLoadingCheckins(true)

    try {
      const res = await fetch(`/api/fleet/checkins?vehicleId=${vehicleId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao buscar check-ins')

      const data: Array<VehicleCheckin & { vehicleStatus?: string }> = await res.json()
      setCheckins(
        data.map((item) => ({
          ...item,
          vehicleStatus: item.vehicleStatus || (item as any).vehicle?.status,
          vehiclePlateSnapshot: item.vehiclePlateSnapshot || (item as any).vehicle?.plate,
          vehicleTypeSnapshot: item.vehicleTypeSnapshot || (item as any).vehicle?.type,
        })),
      )
    } catch (err) {
      console.error(err)
      setCheckins([])
    } finally {
      setLoadingCheckins(false)
    }
  }

  async function loadStatusLogs(vehicleId: string) {
    if (!canManageVehicles) return
    setLoadingStatusLogs(true)
    setStatusError(null)

    try {
      const res = await fetch(`/api/fleet/vehicles/status?vehicleId=${vehicleId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar histórico de status')

      const data: VehicleStatusLog[] = await res.json()
      setStatusLogs(data)
    } catch (err) {
      console.error(err)
      setStatusLogs([])
      setStatusError('Não foi possível carregar o histórico de status.')
    } finally {
      setLoadingStatusLogs(false)
    }
  }

  function openStatusModal(vehicle: ApiVehicle) {
    if (!canManageVehicles) return

    const normalized = getStatusInfo(vehicle.status).normalized
    const initialStatus = statusOptions.some((option) => option.value === normalized) ? normalized : 'DISPONIVEL'

    setStatusModalVehicle(vehicle)
    setStatusSelection(initialStatus)
    setStatusReason('')
    setTypedReasonBackup('')
    setStatusError(null)
    setStatusLogs([])
    setViewingLogId(null)
    loadStatusLogs(vehicle.id)
  }

  async function submitStatusChange() {
    if (!statusModalVehicle) return
    if (!canManageVehicles) {
      setStatusError('Você não tem permissão para alterar o status dos veículos.')
      return
    }
    if (viewingLogId) {
      setStatusError('Clique em "Escrever novo motivo" para registrar uma nova alteração.')
      return
    }

    setStatusSubmitting(true)
    setStatusError(null)

    try {
      const res = await fetch('/api/fleet/vehicles/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: statusModalVehicle.id,
          status: statusSelection,
          reason: statusReason.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao alterar status do veículo')
      }

      const log: VehicleStatusLog = await res.json()

      setVehicles((prev) => prev.map((v) => (v.id === statusModalVehicle.id ? { ...v, status: statusSelection } : v)))
      setSelectedVehicle((prev) => (prev?.id === statusModalVehicle.id ? { ...prev, status: statusSelection } : prev))
      setStatusLogs((prev) => [log, ...prev])

      setStatusReason('')
      setTypedReasonBackup('')
    } catch (err: any) {
      console.error(err)
      setStatusError(err.message || 'Erro ao salvar status')
    } finally {
      setStatusSubmitting(false)
    }
  }

  function openCreateForm() {
    if (!canManageVehicles) return
    setEditingVehicle(null)
    setFormValues({ plate: '', type: '', model: '', sector: '', kmCurrent: '', costCenterIds: [] })
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(vehicle: ApiVehicle) {
    if (!canManageVehicles) return
    setEditingVehicle(vehicle)
    setFormValues({
      plate: vehicle.plate,
      type: vehicle.type,
      model: vehicle.model || '',
      sector: vehicle.sector || '',
      kmCurrent: vehicle.kmCurrent?.toString() || '',
      costCenterIds: vehicle.costCenters?.map((l) => l.costCenter?.id || null).filter((id): id is string => !!id) || [],
    })
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSubmit() {
    if (!canManageVehicles) {
      setFormError('Seu acesso permite apenas consulta aos veículos.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    if (!isPlateValid) {
      setFormError('Informe uma placa no formato ABC1A34 (Mercosul) ou ABC1234 (antiga)')
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
    if (!canManageVehicles) {
      alert('Você não tem permissão para excluir veículos.')
      return
    }
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

      {permissionsLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-700">
          <Loader2 size={16} className="animate-spin" /> Carregando permissões de acesso...
        </div>
      ) : !canViewVehicles ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          Seu perfil permite apenas visualizar o checklist diário. Solicite elevação para acessar o cadastro de veículos.
        </div>
      ) : (
        <>
          {fleetLevel === 'NIVEL_2' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Acesso em modo consulta: visualize veículos, check-ins e baixe formulários. Edição liberada apenas para
              usuários nível 3.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadVehicles}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Recarregar lista
            </button>

            {canManageVehicles && (
              <button
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
              >
                <Plus size={16} /> Registrar veículo
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
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
                    Status
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
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-600">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" /> Carregando veículos...
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && vehicles.length === 0 && !error && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-600">
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
                        <td className="px-6 py-4 text-sm">
                          {(() => {
                            const info = getStatusInfo(vehicle.status)
                            return (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${info.colorClass}`}
                                >
                                  {info.label || '—'}
                                </span>
                                {canManageVehicles && (
                                  <button
                                    onClick={() => openStatusModal(vehicle)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                                    title="Alterar status"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                )}
                              </div>
                            )
                          })()}
                        </td>
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

                            {canManageVehicles ? (
                              <>
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
                              </>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                                Consulta
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {/* painel de check-ins */}
          {selectedVehicle && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase text-slate-500">Check-ins do veículo</p>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedVehicle.plate}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => loadCheckins(selectedVehicle.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <RefreshCw size={14} /> Atualizar
                  </button>

                  <button
                    onClick={() => setCheckinsCollapsed((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    {checkinsCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                    {checkinsCollapsed ? 'Maximizar visão' : 'Minimizar visão'}
                  </button>

                  <a
                    href={monthlyDocUrl}
                    className="inline-flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    <List size={14} /> Checklist mensal (Word)
                  </a>
                </div>
              </div>

              {checkinsCollapsed ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  Visão dos check-ins minimizada. Clique em “Maximizar visão” para reabrir os filtros e os registros.
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 md:grid-cols-4">
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Filtrar por mês</span>
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value || currentMonth)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Data inicial</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Data final</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                      />
                    </label>

                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => {
                          setCustomStartDate('')
                          setCustomEndDate('')
                          setSelectedMonth(currentMonth)
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        <X size={14} /> Limpar filtros
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">Período aplicado: {appliedPeriodLabel}</p>

                  <div className="mt-4 space-y-3">
                    {loadingCheckins && (
                      <div className="flex justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-slate-600">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin" /> Carregando check-ins...
                        </div>
                      </div>
                    )}

                    {!loadingCheckins && checkins.length === 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-center text-slate-600">
                        Nenhum check-in encontrado para este veículo.
                      </div>
                    )}

                    {!loadingCheckins && checkins.length > 0 && filteredCheckins.length === 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-center text-amber-800">
                        Não há check-ins dentro do período selecionado.
                      </div>
                    )}

                    {!loadingCheckins &&
                      filteredCheckins.map((checkin) => {
                        const statusInfo = getStatusInfo(checkin.vehicleStatus || selectedVehicle.status)
                        const driverStatusInfo = getDriverStatusInfo(checkin.driverStatus)
                        const checklist = checkin.checklistJson || []
                        const fatigue = checkin.fatigueJson || []
                        const driverNames = extractDriverNames(checkin)

                        return (
                          <details key={checkin.id} className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                              <div className="space-y-0.5">
                                <p>
                                  {formatDateTime(checkin.inspectionDate)} • KM {formatKm(checkin.kmAtInspection)}
                                </p>
                                <p className="text-xs font-normal text-slate-600">
                                  {driverNames.length > 0
                                    ? driverNames.join(' • ')
                                    : checkin.driver?.fullName || checkin.driverName || 'Motorista não informado'}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.colorClass}`}
                                >
                                  {statusInfo.label || '—'}
                                </span>

                                <span
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${driverStatusInfo.colorClass}`}
                                >
                                  Motorista {driverStatusInfo.label}
                                </span>
                              </div>
                            </summary>

                            <div className="mt-4 space-y-3">
                              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-slate-900">Dados do veículo</p>
                                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                      Registro
                                    </span>
                                  </div>

                                  <dl className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                                    <div>
                                      <dt className="text-xs uppercase text-slate-500">Placa</dt>
                                      <dd className="font-semibold text-slate-900">
                                        {checkin.vehiclePlateSnapshot || selectedVehicle.plate}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs uppercase text-slate-500">Tipo</dt>
                                      <dd>{checkin.vehicleTypeSnapshot || selectedVehicle.type || '—'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs uppercase text-slate-500">KM no check-in</dt>
                                      <dd>{formatKm(checkin.kmAtInspection)}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs uppercase text-slate-500">Centro de custo</dt>
                                      <dd>{checkin.costCenter || '—'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs uppercase text-slate-500">Setor</dt>
                                      <dd>{checkin.sectorActivity || '—'}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs uppercase text-slate-500">Status</dt>
                                      <dd>
                                        <span
                                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusInfo.colorClass}`}
                                        >
                                          {statusInfo.label || '—'}
                                        </span>
                                      </dd>
                                    </div>
                                  </dl>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-white p-4 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-slate-900">Condutor(es)</p>
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${driverStatusInfo.colorClass}`}
                                    >
                                      {driverStatusInfo.label}
                                    </span>
                                  </div>

                                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                                    <div>
                                      <p className="text-xs uppercase text-slate-500">Nome(s)</p>
                                      {driverNames.length > 0 ? (
                                        <div className="mt-1 flex flex-wrap gap-2">
                                          {driverNames.map((name) => (
                                            <span
                                              key={name}
                                              className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-indigo-100"
                                            >
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="mt-1 text-slate-500">—</p>
                                      )}
                                    </div>

                                    <div>
                                      <p className="text-xs uppercase text-slate-500">E-mail</p>
                                      <p className="mt-1">{checkin.driver?.email || '—'}</p>
                                    </div>

                                    <div>
                                      <p className="text-xs uppercase text-slate-500">Aptidão do motorista</p>
                                      <p className="mt-1 text-base font-semibold text-slate-900">{driverStatusInfo.label}</p>
                                      <p className="text-xs text-slate-500">Resultado do checklist de fadiga.</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-amber-50 via-white to-white p-4 shadow-sm">
                                  <p className="text-sm font-semibold text-slate-900">Não conformidades</p>
                                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                                    <p>
                                      <span className="text-xs uppercase text-slate-500">Possui não conformidade</span>
                                      <br />
                                      {checkin.hasNonConformity ? 'Sim' : 'Não'}
                                    </p>
                                    <p>
                                      <span className="text-xs uppercase text-slate-500">Criticidade</span>
                                      <br />
                                      {checkin.nonConformityCriticality || '—'}
                                    </p>
                                    <p>
                                      <span className="text-xs uppercase text-slate-500">Tratativas</span>
                                      <br />
                                      {checkin.nonConformityActions || '—'}
                                    </p>
                                    <p>
                                      <span className="text-xs uppercase text-slate-500">Responsável</span>
                                      <br />
                                      {checkin.nonConformityManager || '—'}
                                    </p>
                                    <p>
                                      <span className="text-xs uppercase text-slate-500">Data da tratativa</span>
                                      <br />
                                      {formatDate(checkin.nonConformityDate)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="space-y-2 rounded-md border border-slate-200 bg-white/60 p-3 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-slate-900">Checklist informado</p>
                                    <span className="text-xs uppercase text-slate-500">Itens</span>
                                  </div>

                                  {checklist.length === 0 && <p className="text-xs text-slate-500">Nenhum item registrado.</p>}

                                  {checklist.map((item, idx) => (
                                    <div
                                      key={`${item.name}-${idx}`}
                                      className="flex items-center justify-between gap-3 rounded border border-slate-100 bg-slate-50 px-3 py-2"
                                    >
                                      <div className="text-xs text-slate-700">
                                        <p className="font-semibold">{item.label || item.name}</p>
                                        <p className="text-slate-500">Categoria: {item.category || '—'}</p>
                                      </div>

                                      <span
                                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                          item.status === 'COM_PROBLEMA'
                                            ? 'bg-red-100 text-red-800'
                                            : item.status === 'NAO_SE_APLICA'
                                              ? 'bg-slate-100 text-slate-700'
                                              : 'bg-green-100 text-green-800'
                                        }`}
                                      >
                                        {item.status || 'OK'}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                <div className="space-y-2 rounded-md border border-slate-200 bg-white/60 p-3 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-slate-900">Controle de fadiga</p>
                                    <span className="text-xs uppercase text-slate-500">{checkin.fatigueRisk || '—'}</span>
                                  </div>

                                  <p className="text-xs text-slate-500">
                                    Pontuação: <span className="font-semibold text-slate-800">{checkin.fatigueScore ?? '—'}</span>
                                  </p>

                                  {fatigue.length === 0 && <p className="text-xs text-slate-500">Sem respostas registradas.</p>}

                                  {fatigue.map((item, idx) => (
                                    <div
                                      key={`${item.name}-${idx}`}
                                      className="flex items-center justify-between gap-3 rounded border border-slate-100 bg-slate-50 px-3 py-2"
                                    >
                                      <p className="text-xs font-semibold text-slate-800">{item.label || item.name}</p>
                                      <span
                                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                          item.answer === 'SIM' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                        }`}
                                      >
                                        {item.answer || '—'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </details>
                        )
                      })}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ✅ Modal Status (único) */}
      {statusModalVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative grid w-full max-w-5xl gap-6 rounded-2xl bg-white p-6 shadow-2xl md:grid-cols-[2fr_1fr]">
            <button
              onClick={() => {
                setStatusModalVehicle(null)
                setStatusLogs([])
                setStatusError(null)
                setViewingLogId(null)
                setStatusReason('')
              }}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Fechar"
            >
              <X size={16} />
            </button>

            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Alterar status</p>
                  <h2 className="text-2xl font-bold text-slate-900">{statusModalVehicle.plate}</h2>
                  <p className="text-sm text-slate-600">Selecione o status desejado e informe o motivo da alteração.</p>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getStatusInfo(statusModalVehicle.status).colorClass}`}
                >
                  {getStatusInfo(statusModalVehicle.status).label}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Status do veículo</p>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {statusOptions.map((option) => {
                    const active = statusSelection === option.value
                    return (
                      <button
                        key={option.value}
                        onClick={() => setStatusSelection(option.value)}
                        disabled={statusSubmitting || Boolean(viewingLogId)}
                        className={`flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-[1px] hover:shadow ${
                          active
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                        } ${viewingLogId ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Motivo da alteração*</p>
                  {viewingLogId && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Visualizando log
                    </span>
                  )}
                </div>

                <textarea
                  value={statusReason}
                  onChange={(e) => {
                    if (viewingLogId) return
                    setStatusReason(e.target.value)
                    setTypedReasonBackup(e.target.value)
                  }}
                  readOnly={Boolean(viewingLogId)}
                  className="min-h-[140px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Descreva o motivo da mudança de status"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Obrigatório sempre que um novo status for salvo.</span>
                  {viewingLogId ? (
                    <button
                      className="text-blue-700 hover:underline"
                      onClick={() => {
                        setViewingLogId(null)
                        setStatusReason(typedReasonBackup)
                      }}
                    >
                      Escrever novo motivo
                    </button>
                  ) : (
                    <span>Clique em um log ao lado para visualizar o motivo anterior.</span>
                  )}
                </div>
              </div>

              {statusError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{statusError}</div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setStatusModalVehicle(null)
                    setStatusLogs([])
                    setStatusError(null)
                    setViewingLogId(null)
                    setStatusReason('')
                  }}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  disabled={statusSubmitting}
                >
                  Cancelar
                </button>

                <button
                  onClick={submitStatusChange}
                  disabled={statusSubmitting || Boolean(viewingLogId)}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statusSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Salvar status
                </button>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Histórico</p>
                  <p className="text-sm font-semibold text-slate-900">Logs anteriores</p>
                  <p className="text-xs text-slate-600">Clique em um log para visualizar o motivo.</p>
                </div>
                {loadingStatusLogs && <Loader2 size={16} className="mt-1 animate-spin text-slate-500" />}
              </div>

              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {statusLogs.length === 0 && !loadingStatusLogs && (
                  <p className="text-xs text-slate-600">Nenhum log de status registrado para este veículo.</p>
                )}

                {statusLogs.map((log) => {
                  const info = getStatusInfo(log.status)
                  const isActive = viewingLogId === log.id
                  const normalized = statusOptions.some((option) => option.value === info.normalized) ? info.normalized : 'DISPONIVEL'

                  return (
                    <button
                      key={log.id}
                      onClick={() => {
                        setTypedReasonBackup(statusReason)
                        setViewingLogId(log.id)
                        setStatusReason(log.reason)
                        setStatusSelection(normalized)
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-left text-sm shadow-sm transition hover:-translate-y-[1px] hover:shadow ${
                        isActive ? 'border-blue-200 bg-white' : 'border-slate-200 bg-white/70 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${info.colorClass}`}>{info.label}</span>
                          <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                        </div>
                        {isActive && <span className="text-[11px] font-semibold uppercase text-blue-700">Selecionado</span>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-800">{log.reason}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.createdBy?.fullName || log.createdBy?.email || 'Usuário não identificado'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal do form */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {editingVehicle ? 'Editar' : 'Cadastrar'} veículo
                </p>
                <h2 className="text-2xl font-bold text-slate-900">{editingVehicle ? editingVehicle.plate : 'Novo veículo'}</h2>
              </div>
              <button onClick={() => setFormOpen(false)} className="text-sm text-slate-500 hover:text-slate-800">
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1 text-sm text-slate-700">
                <span>Placa*</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.plate}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, plate: e.target.value }))}
                  placeholder="ABC1A34 ou ABC1234"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Tipo*</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.type}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, type: e.target.value }))}
                  placeholder="Ex.: 4x4"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Modelo</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.model}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, model: e.target.value }))}
                  placeholder="Ex.: Toro"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-700">
                <span>Setor</span>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2"
                  value={formValues.sector}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, sector: e.target.value }))}
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
                    const label = cc.description || cc.code || cc.externalCode || 'Centro de custo'
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
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
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
