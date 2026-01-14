'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSessionMe } from '@/components/session/SessionProvider'
import { ShieldAlert } from 'lucide-react'

type FleetLevel = 'NIVEL_1' | 'NIVEL_2' | 'NIVEL_3'

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
  const { data: sessionData, loading: sessionLoading } = useSessionMe()
  const [checkins, setCheckins] = useState<DisplacementCheckin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fleetLevel, setFleetLevel] = useState<FleetLevel | null>(null)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null)
  const [activeLogId, setActiveLogId] = useState<string | null>(null)

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
    if (sessionLoading) return
    setPermissionsLoading(true)
    setPermissionError(null)
    try {
      const rawLevel =
        sessionData?.appUser?.moduleLevels?.['gestao-de-frotas'] ||
        sessionData?.appUser?.moduleLevels?.gestao_frotas
      const level: FleetLevel | null =
        rawLevel === 'NIVEL_1' || rawLevel === 'NIVEL_2' || rawLevel === 'NIVEL_3'
          ? rawLevel
          : null

      setFleetLevel(level)
    } catch (err) {
      console.error(err)
      setPermissionError('Não foi possível verificar suas permissões no momento.')
      setFleetLevel(null)
    } finally {
      setPermissionsLoading(false)
    }
  }, [sessionData, sessionLoading])

  const canViewPanel = fleetLevel === 'NIVEL_2' || fleetLevel === 'NIVEL_3'

  useEffect(() => {
    if (permissionsLoading) return

    if (!canViewPanel) {
      setLoading(false)
      setCheckins([])
      return
    }
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
  }, [canViewPanel, permissionsLoading])

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
    return checkins
      .filter((checkin) => {
        const plate = checkin.vehiclePlateSnapshot || checkin.vehicle?.plate || ''
        return plate.toUpperCase() === normalized
      })
      .sort((a, b) => {
        const aDate = a.tripDate ? new Date(a.tripDate).getTime() : 0
        const bDate = b.tripDate ? new Date(b.tripDate).getTime() : 0
        return bDate - aDate
      })
  }, [checkins, selectedPlate])
  useEffect(() => {
    if (logEntries.length > 0) {
      setActiveLogId(logEntries[0].id)
    } else {
      setActiveLogId(null)
    }
  }, [logEntries])

  const activeLog = useMemo(() => {
    if (!logEntries.length) return null
    return logEntries.find((log) => log.id === activeLogId) ?? logEntries[0] ?? null
  }, [activeLogId, logEntries])


  const handleOpenLog = (plate: string) => {
    setSelectedPlate(plate)
  }

  const handleCloseLog = () => setSelectedPlate(null)
  if (permissionsLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 text-slate-700">
          <ShieldAlert className="text-orange-500" size={18} />
          <div>
            <p className="text-sm font-semibold">Carregando permissões…</p>
            <p className="text-xs text-slate-500">Validando seu nível de acesso ao módulo de frotas.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!canViewPanel) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-orange-900 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 text-orange-500" size={20} />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Painel disponível apenas para níveis 2 e 3</p>
              <p className="text-sm">
                Usuários do nível 1 podem continuar registrando check-ins diários e de deslocamento, mas não conseguem
                consultar este painel de consolidação.
              </p>
              {permissionError && <p className="text-xs text-orange-700">{permissionError}</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/dashboard/gestao-de-frotas/checkins"
            className="inline-flex items-center justify-center rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
          >
            Ir para check-ins diários
          </Link>
          <Link
            href="/dashboard/gestao-de-frotas/deslocamento/checkin"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Registrar deslocamento
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Gestão de Frotas</p>
            <h1 className="text-2xl font-bold text-slate-900">Painel de check-ins de deslocamento</h1>
            <p className="text-sm text-slate-600">
              Acompanhe os deslocamentos registrados pela equipe, com origem, destino e centros de custo vinculados.
            </p>
          </div>
          <Link
            href="/dashboard/gestao-de-frotas/deslocamento/checkin"
            className="inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 sm:w-auto"
          >
            Novo check-in
          </Link>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="relative mt-10 w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 max-h-[80vh] overflow-y-auto">
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

             <div className="grid gap-4 md:grid-cols-[1.6fr,1fr] lg:min-h-[420px]">
              <div className="flex min-h-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Log atual</p>
                    <h4 className="text-lg font-bold text-slate-900">
                      {activeLog?.tripDate ? formatter.format(new Date(activeLog.tripDate)) : '—'}
                    </h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {activeLog?.vehiclePlateSnapshot || activeLog?.vehicle?.plate || '—'}
                  </span>
                </div>

                {activeLog ? (
                   <div className="grid flex-1 gap-3 overflow-y-auto text-sm text-slate-700 sm:grid-cols-2">
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Origem</p>
                      <p className="text-base font-semibold text-slate-900">{activeLog.origin}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Destino</p>
                      <p className="text-base font-semibold text-slate-900">{activeLog.destination}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Centro de custo</p>
                      <p className="text-base font-semibold text-slate-900">
                        {activeLog.costCenter
                          ? `${activeLog.costCenter.externalCode ? `${activeLog.costCenter.externalCode} - ` : ''}${activeLog.costCenter.description ?? ''}`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Motorista</p>
                      <p className="text-base font-semibold text-slate-900">{activeLog.driver?.fullName || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Modelo</p>
                      <p className="text-base font-semibold text-slate-900">
                        {activeLog.vehicleModelSnapshot || activeLog.vehicle?.model || '—'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Tipo</p>
                      <p className="text-base font-semibold text-slate-900">
                        {activeLog.vehicleTypeSnapshot || activeLog.vehicle?.type || '—'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Quilometragem</p>
                      <p className="text-base font-semibold text-slate-900">
                        {typeof activeLog.vehicleKmSnapshot === 'number'
                          ? `${activeLog.vehicleKmSnapshot.toLocaleString('pt-BR')} km`
                          : '—'}
                       </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs font-semibold uppercase text-slate-500">Placa</p>
                      <p className="text-base font-semibold text-slate-900">
                        {activeLog.vehiclePlateSnapshot || activeLog.vehicle?.plate || '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                 <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-sm text-slate-500">
                    Nenhum deslocamento registrado para esta placa.
                  </div>
                )}
              </div>

              <div className="flex min-h-[340px] flex-col space-y-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Logs anteriores</p>
                    <h4 className="text-lg font-bold text-slate-900">Histórico</h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {logEntries.length} log(s)
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {logEntries.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-500">
                      Nenhum deslocamento registrado para esta placa.
                    </p>

                  )}
                  {logEntries.map((log) => {
                    const isActive = activeLog?.id === log.id
                    return (
                      <button
                        type="button"
                        key={log.id}
                        onClick={() => setActiveLogId(log.id)}
                        aria-pressed={isActive}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                          isActive
                            ? 'border-orange-200 bg-white shadow-sm'
                            : 'border-transparent bg-white/60 hover:border-orange-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex-1 space-y-1 text-sm text-slate-700">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                            <span>{log.tripDate ? formatter.format(new Date(log.tripDate)) : '—'}</span>
                            {typeof log.vehicleKmSnapshot === 'number' && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {log.vehicleKmSnapshot.toLocaleString('pt-BR')} km
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900">
                            {log.origin} → {log.destination}
                          </p>
                          <p className="text-xs text-slate-600">
                            {log.vehiclePlateSnapshot || log.vehicle?.plate || '—'} ·{' '}
                            {log.vehicleModelSnapshot || log.vehicle?.model || '—'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}