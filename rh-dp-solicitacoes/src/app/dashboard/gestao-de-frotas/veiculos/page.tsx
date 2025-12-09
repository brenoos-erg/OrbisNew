'use client'

import { FormEvent, useMemo, useState } from 'react'
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react'

type VehicleStatus = 'Disponível' | 'Em uso' | 'Em manutenção' | 'Reservado'

type Vehicle = {
  id: string
  plate: string
  model: string
  status: VehicleStatus
  km: number
  driver: string
  fuel: string
  criticalIssues: Record<string, boolean>
}

const criticalIssueOptions = [
  { id: 'pneus', label: 'Pneus' },
  { id: 'freios', label: 'Freios' },
  { id: 'luzes', label: 'Luzes' },
  { id: 'documentacao', label: 'Documentação' },
]

const initialVehicles: Vehicle[] = [
  {
    id: '1',
    plate: 'ABC-1D23',
    model: 'Fiat Uno Attractive',
    status: 'Disponível',
    km: 32540,
    driver: 'Marcos Silva',
    fuel: '3/4 tanque',
    criticalIssues: { pneus: false, freios: false, luzes: false, documentacao: false },
  },
  {
    id: '2',
    plate: 'XYZ-4F56',
    model: 'Chevrolet S10 LTZ',
    status: 'Em manutenção',
    km: 68210,
    driver: '—',
    fuel: '1/2 tanque',
    criticalIssues: { pneus: false, freios: true, luzes: false, documentacao: false },
  },
  {
    id: '3',
    plate: 'JKL-7M89',
    model: 'Renault Kangoo Express',
    status: 'Em uso',
    km: 15980,
    driver: 'Patrícia Gomes',
    fuel: 'Cheio',
    criticalIssues: { pneus: false, freios: false, luzes: false, documentacao: false },
  },
  {
    id: '4',
    plate: 'QWE-0R12',
    model: 'Volkswagen Saveiro',
    status: 'Disponível',
    km: 23410,
    driver: '—',
    fuel: '5/8 tanque',
    criticalIssues: { pneus: true, freios: false, luzes: false, documentacao: false },
  },
]

const emptyVehicle: Vehicle = {
  id: '',
  plate: '',
  model: '',
  status: 'Disponível',
  km: 0,
  driver: '—',
  fuel: 'Tanque vazio',
  criticalIssues: { pneus: false, freios: false, luzes: false, documentacao: false },
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Disponível':
      return 'bg-green-100 text-green-800'
    case 'Em manutenção':
      return 'bg-amber-100 text-amber-800'
    case 'Em uso':
      return 'bg-blue-100 text-blue-800'
    case 'Restrito':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

function deriveStatus(vehicle: Vehicle) {
  const hasCriticalFailure = Object.values(vehicle.criticalIssues).some(Boolean)
  return hasCriticalFailure ? 'Restrito' : vehicle.status
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Vehicle>(emptyVehicle)

  const anyRestricted = useMemo(
    () => vehicles.filter((vehicle) => deriveStatus(vehicle) === 'Restrito'),
    [vehicles]
  )

  function openCreate() {
    setEditingId(null)
    setFormData({ ...emptyVehicle, id: '' })
    setShowForm(true)
  }

  function openEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id)
    setFormData(vehicle)
    setShowForm(true)
  }

  function toggleCritical(id: string) {
    setFormData((prev) => ({
      ...prev,
      criticalIssues: { ...prev.criticalIssues, [id]: !prev.criticalIssues[id] },
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formData.plate || !formData.model) return

    if (editingId) {
      setVehicles((prev) => prev.map((v) => (v.id === editingId ? { ...formData, id: editingId } : v)))
    } else {
      const newVehicle: Vehicle = { ...formData, id: crypto.randomUUID() }
      setVehicles((prev) => [newVehicle, ...prev])
    }

    setShowForm(false)
    setFormData(emptyVehicle)
    setEditingId(null)
  }

  function handleDelete(id: string) {
    setVehicles((prev) => prev.filter((v) => v.id !== id))
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Veículos</h1>
        <p className="text-slate-600 mt-2 max-w-3xl">
          Cadastre, edite e exclua veículos da frota. O status muda automaticamente para Restrito sempre que algum
          item crítico tiver falha registrada.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
        >
          <Plus size={16} /> Cadastrar veículo
        </button>
        <button className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-slate-800 hover:bg-slate-200">
          Exportar planilha
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                {editingId ? 'Editar veículo' : 'Novo veículo'}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Dados principais</h2>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Placa
                <input
                  required
                  value={formData.plate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, plate: e.target.value.toUpperCase() }))}
                  placeholder="ABC1D23"
                  className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-slate-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Modelo
                <input
                  required
                  value={formData.model}
                  onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Status
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as VehicleStatus }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                >
                  <option value="Disponível">Disponível</option>
                  <option value="Em uso">Em uso</option>
                  <option value="Em manutenção">Em manutenção</option>
                  <option value="Reservado">Reservado</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Quilometragem
                <input
                  type="number"
                  min={0}
                  value={formData.km}
                  onChange={(e) => setFormData((prev) => ({ ...prev, km: Number(e.target.value) }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Motorista
                <input
                  value={formData.driver}
                  onChange={(e) => setFormData((prev) => ({ ...prev, driver: e.target.value }))}
                  placeholder="—"
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Combustível
                <input
                  value={formData.fuel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fuel: e.target.value }))}
                  placeholder="1/2 tanque"
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                />
              </label>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-800">
                <AlertTriangle size={18} className="text-red-600" />
                <div>
                  <p className="text-sm font-semibold">Itens críticos</p>
                  <p className="text-xs text-slate-600">Qualquer falha aqui bloqueia o veículo automaticamente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {criticalIssueOptions.map((issue) => (
                  <label key={issue.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.criticalIssues[issue.id]}
                      onChange={() => toggleCritical(issue.id)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>Falha em {issue.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
              >
                {editingId ? 'Salvar alterações' : 'Adicionar veículo'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {anyRestricted.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {anyRestricted.length} veículo(s) está(ão) restritos por falha crítica. Corrija o item para liberar.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Placa</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Modelo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Motorista</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">KM</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Itens críticos</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Combustível</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {vehicles.map((vehicle) => {
              const displayStatus = deriveStatus(vehicle)
              const failingItems = criticalIssueOptions.filter((issue) => vehicle.criticalIssues[issue.id])
              return (
                <tr key={vehicle.id || vehicle.plate} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{vehicle.plate}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{vehicle.model}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(displayStatus)}`}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{vehicle.driver}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{vehicle.km.toLocaleString('pt-BR')} km</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {failingItems.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {failingItems.map((issue) => (
                          <span key={issue.id} className="inline-flex items-center gap-2 text-xs text-red-700">
                            <AlertTriangle size={14} /> {issue.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Sem falhas</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{vehicle.fuel}</td>
                  <td className="px-6 py-4 text-right text-sm text-slate-700">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => openEdit(vehicle)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100"
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
    </div>
  )
}
