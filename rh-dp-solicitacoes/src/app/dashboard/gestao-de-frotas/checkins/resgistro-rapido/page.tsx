'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
type CostCenterOption = {
  id: string
  label: string
}


type QuickEntry = {
  id: string
  driverName: string
  vehiclePlate: string
  km: number
  shift: string
  fuelLevel: string
  criticalFailures: string[]
  notes: string
  status: 'Disponível' | 'Restrito'
}

const criticalOptions = ['Pneus', 'Freios', 'Luzes', 'Documentação']

export default function QuickCheckinPage() {
  const [entries, setEntries] = useState<QuickEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vehicleExists, setVehicleExists] = useState<boolean | null>(null)
  const [lastKm, setLastKm] = useState<number | null>(null)
  const [plateInput, setPlateInput] = useState('')
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [costCenterInput, setCostCenterInput] = useState('')
  const [costCenterId, setCostCenterId] = useState<string | undefined>()

  const lastEntry = useMemo(() => entries[0], [entries])
  const plateRegex = /^[A-Z]{3}\d{4}$/
  const plateIsValid = plateRegex.test(plateInput)

  useEffect(() => {
    async function loadCostCenters() {
      try {
        const res = await fetch('/api/cost-centers/select', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao buscar centros de custo')
        const data: Array<{ id: string; code: string | null; description: string }> = await res.json()
        setCostCenters(
          data.map((cc) => ({
            id: cc.id,
            label: `${cc.code ? `${cc.code} - ` : ''}${cc.description}`,
          }))
        )
      } catch (err) {
        console.error(err)
        setCostCenters([])
      }
    }

    loadCostCenters()
  }, [])

  useEffect(() => {
    const match = costCenters.find((cc) => cc.label.toLowerCase() === costCenterInput.trim().toLowerCase())
    setCostCenterId(match?.id)
  }, [costCenterInput, costCenters])

  useEffect(() => {
    async function checkVehicle(plate: string) {
      setVehicleExists(null)
      setLastKm(null)

      try {
        const res = await fetch(`/api/fleet/vehicles?plate=${encodeURIComponent(plate)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Erro ao buscar veículo')
        const vehicles: Array<{ plate: string; kmCurrent?: number }> = await res.json()
        const found = vehicles.find((v) => v.plate.toUpperCase() === plate)
        setVehicleExists(Boolean(found))
        setLastKm(found?.kmCurrent ?? null)
      } catch (err) {
        console.error(err)
        setVehicleExists(false)
        setLastKm(null)
      }
    }

    if (plateIsValid) {
      checkVehicle(plateInput)
    } else {
      setVehicleExists(null)
      setLastKm(null)
    }
  }, [plateInput, plateIsValid])

  function buildDatePieces() {
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const time = now.toTimeString().slice(0, 5)
    return { date, time }
  }


async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
     if (!plateIsValid) {
      setError('Informe uma placa no formato ABC1234')
      return
    }

    if (costCenterInput && !costCenterId) {
      setError('Selecione um centro de custo existente para prosseguir')
      return
    }

    setSubmitting(true)
    setError(null)
    const formData = new FormData(event.currentTarget)

    const driverName = (formData.get('driverName') as string)?.trim()
    const vehiclePlate = plateInput.trim().toUpperCase()
    const km = Number(formData.get('km') ?? 0)
    const shift = (formData.get('shift') as string) || 'Manhã'
    const fuelLevel = (formData.get('fuelLevel') as string) || 'Não informado'
    const notes = (formData.get('notes') as string) || ''
    const criticalFailures = criticalOptions.filter((option) => formData.get(`critical-${option}`))
    const status: QuickEntry['status'] = criticalFailures.length > 0 ? 'Restrito' : 'Disponível'
    const { date, time } = buildDatePieces()

    const vehicleChecklist = criticalOptions.map((option) => ({
      name: option,
      label: option,
      category: 'CRITICO',
      status: criticalFailures.includes(option) ? 'COM_PROBLEMA' : 'OK',
    }))

    const payload = {
      inspectionDate: date,
      inspectionTime: time,
      costCenter: costCenterInput || undefined,
      sectorActivity: undefined,
      driverName,
       vehicleType: 'VEICULO_LEVE',
      vehiclePlate,
     vehicleKm: km,
      vehicleChecklist,
      fatigue: [],
      hasNonConformity: criticalFailures.length > 0 ? 'SIM' : 'NAO',
    }

    try {
      const res = await fetch('/api/fleet/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Não foi possível enviar o check-in')
      }

      const entry: QuickEntry = {
        id: crypto.randomUUID(),
        driverName,
        vehiclePlate,
        km,
        shift,
        fuelLevel,
        notes,
        criticalFailures,
        status,
      }

      setEntries((prev) => [entry, ...prev].slice(0, 5))
      setLastKm(km)
      event.currentTarget.reset()
      setPlateInput('')
      setVehicleExists(null)
      setCostCenterInput('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Check-in rápido</h1>
        <p className="text-slate-600 text-sm max-w-2xl">
          Tela direta para o técnico registrar o veículo em poucos campos. Informe placa, quilometragem, turno e se há
          falha crítica. Sem firula e sem passos adicionais.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Placa do veículo
            <input
              required
              name="vehiclePlate"
              placeholder="ABC1234"
              value={plateInput}
              pattern="[A-Z]{3}[0-9]{4}"
              onChange={(event) => {
                const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                setPlateInput(value.slice(0, 7))
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-orange-500 focus:outline-none"
            />
             <span className="text-xs text-slate-500">
              Use apenas letras e números no formato <strong>ABC1234</strong>.
            </span>
            {vehicleExists !== null && (
              <span
                className={`text-xs font-medium ${vehicleExists ? 'text-green-700' : 'text-orange-700'}`}
              >
                {vehicleExists
                  ? 'Veículo localizado no sistema'
                  : 'Veículo ainda não cadastrado. Será criado ao registrar.'}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Centro de custo
            <input
               name="costCenter"
              list="cost-center-options"
              value={costCenterInput}
              onChange={(event) => setCostCenterInput(event.target.value)}
              placeholder="Digite para buscar"
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            />
             <datalist id="cost-center-options">
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.label} />
              ))}
            </datalist>
            <span className="text-xs text-slate-500">Campo livre, mas ligado aos centros cadastrados.</span>
            {costCenterInput && !costCenterId && (
              <span className="text-xs text-orange-700">Selecione uma opção existente para vincular corretamente.</span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
             Motorista
            <input
              required
              name="driverName"
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            />
          </label>
          {plateIsValid && (
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Quilometragem
              <input
                required
                type="number"
                min={lastKm ?? 0}
                name="km"
                inputMode="numeric"
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">
                Última quilometragem registrada: {lastKm !== null ? lastKm.toLocaleString('pt-BR') : '—'} km
              </span>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Turno
            <select
              name="shift"
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
              defaultValue="Manhã"
            >
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
              <option value="Noite">Noite</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Combustível
            <select
              name="fuelLevel"
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
              defaultValue="3/4 tanque"
            >
              <option value="Cheio">Cheio</option>
              <option value="3/4 tanque">3/4 tanque</option>
              <option value="1/2 tanque">1/2 tanque</option>
              <option value="1/4 tanque">1/4 tanque</option>
              <option value="Reserva">Reserva</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
            Observações rápidas
            <textarea
              name="notes"
              className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
              placeholder="Ex.: arranhão lateral direita"
            />
          </label>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-800">
            <AlertTriangle size={18} className="text-red-600" />
            <div>
              <p className="text-sm font-semibold">Falha crítica</p>
              <p className="text-xs text-slate-600">Marcar qualquer opção deixa o veículo como Restrito.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {criticalOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name={`critical-${option}`}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-70"
          >
            {submitting ? 'Registrando...' : 'Registrar check-in'}
          </button>
          <p className="text-xs text-slate-500">Sem redirecionamento: salva e já fica pronto para o próximo.</p>
        </div>
         {error && <p className="text-sm text-red-700">{error}</p>}
      </form>

      {lastEntry && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Último envio</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Veículo</p>
              <p className="text-lg font-semibold text-slate-900">{lastEntry.vehiclePlate}</p>
              <p className="text-xs text-slate-500">{lastEntry.km.toLocaleString('pt-BR')} km</p>
              <p className="text-xs text-slate-500">Combustível: {lastEntry.fuelLevel}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Motorista</p>
              <p className="text-lg font-semibold text-slate-900">{lastEntry.driverName}</p>
              <p className="text-xs text-slate-500">Turno {lastEntry.shift}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Status do veículo</p>
              <p className="text-lg font-semibold text-slate-900">{lastEntry.status}</p>
              {lastEntry.criticalFailures.length > 0 && (
                <p className="text-xs text-red-700">Falha: {lastEntry.criticalFailures.join(', ')}</p>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Confirmação</p>
              <p className="text-lg font-semibold text-green-700 inline-flex items-center gap-2">
                <CheckCircle2 size={18} /> Registrado
              </p>
              {lastEntry.notes && <p className="text-xs text-slate-500">Obs.: {lastEntry.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}