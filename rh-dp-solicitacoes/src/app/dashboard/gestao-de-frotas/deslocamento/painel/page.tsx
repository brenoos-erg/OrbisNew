'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type DisplacementCheckin = {
  id: string
  tripDate: string
  origin: string
  destination: string
  vehiclePlateSnapshot: string
  vehicleTypeSnapshot: string
  vehicleModelSnapshot?: string | null
  vehicleKmSnapshot?: number | null
  driver: { fullName: string | null }
  vehicle: { plate: string; type: string; model?: string | null }
  costCenter?: { description: string | null; externalCode: string | null } | null
}

export default function DisplacementPanelPage() {
  const [checkins, setCheckins] = useState<DisplacementCheckin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null)

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [],
  )

  useEffect(() => {
    async function loadCheckins() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/fleet/displacement-checkins', { cache: 'no-store' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Não foi possível carregar os check-ins.')
        }
        const data: DisplacementCheckin[] = await res.json()
        setCheckins(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar lista.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadCheckins()
  }, [])

  const latestByPlate = useMemo(() => {
    const seen = new Set<string>()
    const unique: DisplacementCheckin[] = []

    for (const checkin of checkins) {
      const plate = checkin.vehiclePlateSnapshot || checkin.vehicle?.plate || ''
      const normalized = plate.toUpperCase()
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      unique.push(checkin)
    }

    return unique
  }, [checkins])

  const logEntries = useMemo(() => {
    if (!selectedPlate) return []
    const normalized = selectedPlate.toUpperCase()
    return checkins.filter((checkin) => {
      const plate = checkin.vehiclePlateSnapshot || checkin.vehicle?.plate || ''
      return plate.toUpperCase() === normalized
    })
  }, [checkins, selectedPlate])

  const handleOpenLog = (plate: string) => {
    setSelectedPlate(plate)
  }

  const handleCloseLog = () => setSelectedPlate(null)

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Gestão de Frotas</p>
            <h1 className="text-2xl font-bold text-slate-900">Painel de check-ins de deslocamento</h1>
            <p className="text-sm text-slate-600">
              Acompanhe os deslocamentos registrados pela equipe, com origem, destino e centros de custo vinculados.
            </p>
          </div>
          <Link
            href="/dashboard/gestao-de-frotas/deslocamento/checkin"
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Novo check-in
          </Link>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Resumo</p>
            <h2 className="text-lg font-semibold text-slate-900">Deslocamentos recentes</h2>
            <p className="text-sm text-slate-600">Visualize origem, destino e veículo utilizado.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {latestByPlate.length} placa(s) recente(s)
          </span>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Placa</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Modelo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Centro de custo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Origem</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Destino</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Motorista</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Carregando deslocamentos...
                  </td>
                </tr>
              )}

              {!loading && latestByPlate.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Nenhum check-in de deslocamento registrado até o momento.
                  </td>
                </tr>
              )}

              {!loading &&
                latestByPlate.map((checkin) => {
                  const plate = checkin.vehiclePlateSnapshot || checkin.vehicle?.plate || '—'
                  return (
                    <tr key={checkin.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {checkin.tripDate ? formatter.format(new Date(checkin.tripDate)) : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => handleOpenLog(plate)}
                          className="underline decoration-slate-300 decoration-2 transition hover:text-orange-600 hover:decoration-orange-300"
                        >
                          {plate}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {checkin.vehicleModelSnapshot || checkin.vehicle?.model || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {checkin.vehicleTypeSnapshot || checkin.vehicle?.type || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {checkin.costCenter
                          ? `${checkin.costCenter.externalCode ? `${checkin.costCenter.externalCode} - ` : ''}${checkin.costCenter.description ?? ''}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{checkin.origin}</td>
                      <td className="px-4 py-3 text-slate-700">{checkin.destination}</td>
                      <td className="px-4 py-3 text-slate-700">{checkin.driver?.fullName || '—'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPlate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative mt-10 w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Log de deslocamentos</p>
                <h3 className="text-lg font-bold text-slate-900">Placa {selectedPlate}</h3>
                <p className="text-sm text-slate-600">
                  Histórico completo da placa com quilometragem registrada no momento do deslocamento.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseLog}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Data</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Placa</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Modelo</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Tipo</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Centro de custo</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Origem</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Destino</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Motorista</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Quilometragem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logEntries.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700">
                        {log.tripDate ? formatter.format(new Date(log.tripDate)) : '—'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {log.vehiclePlateSnapshot || log.vehicle?.plate || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {log.vehicleModelSnapshot || log.vehicle?.model || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {log.vehicleTypeSnapshot || log.vehicle?.type || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {log.costCenter
                          ? `${log.costCenter.externalCode ? `${log.costCenter.externalCode} - ` : ''}${log.costCenter.description ?? ''}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{log.origin}</td>
                      <td className="px-3 py-2 text-slate-700">{log.destination}</td>
                      <td className="px-3 py-2 text-slate-700">{log.driver?.fullName || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {typeof log.vehicleKmSnapshot === 'number'
                          ? `${log.vehicleKmSnapshot.toLocaleString('pt-BR')} km`
                          : '—'}
                      </td>
                    </tr>
                  ))}

                  {logEntries.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center text-slate-500">
                        Nenhum deslocamento registrado para esta placa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}