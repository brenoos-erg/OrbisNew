'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { isValidPlate } from '@/lib/plate'

type VehicleOption = {
  id: string
  plate: string
  type: string
  model?: string | null
  kmCurrent?: number | null
  costCenters: Array<{
    costCenter?: {
      id: string
      description: string | null
      externalCode: string | null
    } | null
  }>
}

type VehicleSummary = {
  id: string
  plate: string
  type: string
  model?: string | null
  kmCurrent?: number | null
  costCenters: Array<{
    id: string
    label: string
  }>
}

export default function DisplacementCheckinPage() {
  const [plateInput, setPlateInput] = useState('')
  const [vehicle, setVehicle] = useState<VehicleSummary | null>(null)
  const [loadingVehicle, setLoadingVehicle] = useState(false)
  const [tripDate, setTripDate] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [vehicleKmInput, setVehicleKmInput] = useState('')
  const [costCenterId, setCostCenterId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const costCenterOptions = useMemo(() => {
    if (!vehicle) return []
    return vehicle.costCenters
  }, [vehicle])

  useEffect(() => {
    const today = new Date()
    const formatted = today.toISOString().split('T')[0]
    setTripDate(formatted)
  }, [])

  useEffect(() => {
    async function loadVehicle(plate: string) {
      setLoadingVehicle(true)
      setVehicle(null)
      setCostCenterId(null)
      setVehicleKmInput('')
      try {
        const res = await fetch(`/api/fleet/vehicles?plate=${encodeURIComponent(plate)}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Erro ao buscar veículo')
        const data: VehicleOption[] = await res.json()
        const found = data.find((item) => item.plate.toUpperCase() === plate)
        if (!found) {
          setVehicle(null)
          return
        }

        const mappedCostCenters =
          found.costCenters
            ?.map((link) => link.costCenter)
            .filter(Boolean)
            .map((cc) => {
              const description = (cc as { description?: string | null }).description ?? ''
              const externalCode = (cc as { externalCode?: string | null }).externalCode ?? ''
              return {
                id: (cc as { id: string }).id,
                label: externalCode ? `${externalCode} - ${description}` : description,
              }
            }) ?? []

        setVehicle({
          id: found.id,
          plate: found.plate,
          type: found.type,
          model: found.model,
          kmCurrent: found.kmCurrent ?? null,
          costCenters: mappedCostCenters,
        })

        if (mappedCostCenters.length === 1) {
          setCostCenterId(mappedCostCenters[0].id)
        }
        setVehicleKmInput(
          typeof found.kmCurrent === 'number' && Number.isFinite(found.kmCurrent)
            ? String(found.kmCurrent)
            : '',
        )
      } catch (err) {
        console.error(err)
        setVehicle(null)
      } finally {
        setLoadingVehicle(false)
      }
    }

    const normalizedPlate = plateInput.trim().toUpperCase()
    if (isValidPlate(normalizedPlate)) {
      loadVehicle(normalizedPlate)
    } else {
      setVehicle(null)
      setVehicleKmInput('')
    }
  }, [plateInput])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const normalizedPlate = plateInput.trim().toUpperCase()
    if (!isValidPlate(normalizedPlate)) {
      setError('Informe uma placa válida.')
      return
    }

    if (!vehicle) {
      setError('Veículo não localizado. Verifique a placa digitada.')
      return
    }

    if (costCenterOptions.length > 0 && !costCenterId) {
      setError('Selecione um centro de custo do veículo.')
      return
    }

    if (!tripDate) {
      setError('Informe a data do deslocamento.')
      return
    }

    if (!origin.trim() || !destination.trim()) {
      setError('Origem e destino são obrigatórios.')
      return
    }
    const vehicleKmValue =
      vehicleKmInput.trim() === '' ? null : Number.parseInt(vehicleKmInput.trim(), 10)

    if (vehicleKmValue === null || !Number.isFinite(vehicleKmValue) || vehicleKmValue <= 0) {
      setError('Informe a quilometragem do veículo no momento do deslocamento.')
      return
    }

    if (vehicle?.kmCurrent !== null && typeof vehicle?.kmCurrent === 'number') {
      if (vehicleKmValue < vehicle.kmCurrent) {
        setError(
          `A quilometragem informada (${vehicleKmValue.toLocaleString(
            'pt-BR',
          )}) é menor que a última registrada para este veículo (${vehicle.kmCurrent.toLocaleString(
            'pt-BR',
          )}).`,
        )
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/fleet/displacement-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripDate,
          vehiclePlate: normalizedPlate,
          vehicleKm: vehicleKmValue,
          costCenterId: costCenterId ?? undefined,
          origin: origin.trim(),
          destination: destination.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Não foi possível registrar o deslocamento.')
      }

      setSuccess('Check-in de deslocamento registrado com sucesso!')
      setOrigin('')
      setDestination('')
      setVehicleKmInput(vehicleKmValue ? String(vehicleKmValue) : '')
      setCostCenterId(costCenterOptions.length === 1 ? costCenterOptions[0].id : null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado ao registrar.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <header className="space-y-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Gestão de Frotas</p>
            <h1 className="text-2xl font-bold text-slate-900">Check-in de deslocamento</h1>
            <p className="text-sm text-slate-600">
              Informe os dados do deslocamento. Ao digitar a placa, os dados do veículo e seus centros de custo são preenchidos automaticamente.
            </p>
          </div>
          <Link
            href="/dashboard/gestao-de-frotas/deslocamento/painel"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Painel
          </Link>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Dados do deslocamento</p>
            <h2 className="text-lg font-semibold text-slate-900">Identificação</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Placa do veículo
              <input
                required
                name="vehiclePlate"
                type="text"
                placeholder="ABC1A34 ou ABC1234"
                value={plateInput}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  setPlateInput(value.slice(0, 7))
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase focus:border-slate-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">Ao informar a placa, buscaremos os dados do veículo.</span>
              {loadingVehicle && <span className="text-xs text-slate-500">Buscando veículo...</span>}
              {!loadingVehicle && vehicle && (
                <span className="text-xs font-medium text-green-700">Veículo localizado</span>
              )}
              {!loadingVehicle && !vehicle && isValidPlate(plateInput.trim().toUpperCase()) && (
                <span className="text-xs font-medium text-orange-700">Placa não encontrada.</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Data
              <input
                required
                type="date"
                value={tripDate}
                onChange={(event) => setTripDate(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Centro de custo
              <select
                value={costCenterId ?? ''}
                onChange={(event) => setCostCenterId(event.target.value || null)}
                disabled={costCenterOptions.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Selecione</option>
                {costCenterOptions.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.label || 'Sem descrição'}
                  </option>
                ))}
              </select>
              {costCenterOptions.length === 0 && (
                <span className="text-xs text-slate-500">
                  Nenhum centro de custo vinculado ao veículo.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Quilometragem do veículo
              <input
                required
                type="number"
                min={0}
                value={vehicleKmInput}
                onChange={(event) => setVehicleKmInput(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                placeholder="Informe a quilometragem atual"
              />
              <span className="text-xs text-slate-500">
                Último registro conhecido:{' '}
                {typeof vehicle?.kmCurrent === 'number' && Number.isFinite(vehicle.kmCurrent)
                  ? `${vehicle.kmCurrent.toLocaleString('pt-BR')} km`
                  : '—'}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Origem
              <input
                required
                type="text"
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                placeholder="Local de partida"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Destino
              <input
                required
                type="text"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                placeholder="Local de chegada"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Resumo</p>
              <h3 className="text-lg font-semibold text-slate-900">Dados do veículo</h3>
              <p className="text-sm text-slate-600">Confirmar informações antes de registrar.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
              <div><span className="font-medium">Placa:</span> {vehicle?.plate ?? '—'}</div>
              <div><span className="font-medium">Modelo:</span> {vehicle?.model ?? '—'}</div>
              <div><span className="font-medium">Tipo:</span> {vehicle?.type ?? '—'}</div>
              <div>
                <span className="font-medium">Quilometragem:</span>{' '}
                {vehicleKmInput ? `${Number(vehicleKmInput).toLocaleString('pt-BR')} km` : '—'}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Registrando...' : 'Registrar deslocamento'}
          </button>
        </div>
      </form>
    </div>
  )
}