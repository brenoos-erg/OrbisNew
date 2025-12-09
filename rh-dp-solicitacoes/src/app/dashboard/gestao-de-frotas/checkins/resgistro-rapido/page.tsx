'use client'

import { FormEvent, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

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

  const lastEntry = useMemo(() => entries[0], [entries])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)

    const driverName = (formData.get('driverName') as string)?.trim()
    const vehiclePlate = (formData.get('vehiclePlate') as string)?.toUpperCase().trim()
    const km = Number(formData.get('km') ?? 0)
    const shift = (formData.get('shift') as string) || 'Manhã'
    const fuelLevel = (formData.get('fuelLevel') as string) || 'Não informado'
    const notes = (formData.get('notes') as string) || ''
    const criticalFailures = criticalOptions.filter((option) => formData.get(`critical-${option}`))
    const status: QuickEntry['status'] = criticalFailures.length > 0 ? 'Restrito' : 'Disponível'

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
    event.currentTarget.reset()
    setSubmitting(false)
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
              placeholder="ABC1D23"
              className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-orange-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Motorista
            <input
              required
              name="driverName"
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Quilometragem
            <input
              required
              type="number"
              min={0}
              name="km"
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            />
          </label>
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