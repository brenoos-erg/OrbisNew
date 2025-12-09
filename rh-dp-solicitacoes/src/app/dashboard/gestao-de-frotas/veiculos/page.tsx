'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

type ApiVehicle = {
  id: string
  plate: string
  type: string
  model?: string | null
  costCenter?: string | null
  sector?: string | null
  kmCurrent?: number | null
  status?: string | null
  createdAt?: string | null
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

   const restrictedVehicles = useMemo(
    () => vehicles.filter((vehicle) => getStatusInfo(vehicle.status).normalized === 'RESTRITO'),
    [vehicles]
  )

  useEffect(() => {
    loadVehicles()
  }, [])

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

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Veículos</h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          Visualize as informações dos veículos já cadastrados. O status é atualizado automaticamente conforme os check-ins
          realizados pela equipe.
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
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Placa</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Modelo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">KM atual</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Centro de custo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Setor</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-600">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Carregando veículos...
                  </div>
                </td>
              </tr>
            )}

            {!loading && vehicles.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-600">
                  Nenhum veículo cadastrado até o momento.
                </td>
              </tr>
            )}

            {!loading &&
              vehicles.map((vehicle) => {
                const statusInfo = getStatusInfo(vehicle.status)

                return (
                  <tr key={vehicle.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{vehicle.plate}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.type || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.model || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.colorClass}`}>
                        {statusInfo.normalized === 'RESTRITO' && <AlertTriangle size={14} className="mr-2" />}
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{formatKm(vehicle.kmCurrent)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.costCenter || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{vehicle.sector || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{formatDate(vehicle.createdAt)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
