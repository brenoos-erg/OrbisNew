'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { isValidPlate } from '@/lib/plate'

type ChecklistItem = {
  name: string
  label: string
  category: 'CRITICO' | 'NAO_CRITICO'
}

const criticalChecklistItems: ChecklistItem[] = [
  { name: '01', label: 'Freios', category: 'CRITICO' },
  {
    name: '05',
    label: 'Limpadores e sistema de injeção de água no para-brisa',
    category: 'CRITICO',
  },
  { name: '06', label: 'Calibragem de pneus', category: 'CRITICO' },
  {
    name: '07',
    label: 'Farol alto/baxo direito e esquerdo',
    category: 'CRITICO',
  },
  {
    name: '08',
    label: 'Faroletes / pisca alerta / setas',
    category: 'CRITICO',
  },
  {
    name: '09',
    label: 'Macaco / triângulo de segurança / chave de roda',
    category: 'CRITICO',
  },
  { name: '10', label: 'Calço de segurança', category: 'CRITICO' },
  {
    name: '11',
    label: 'Retrovisores externos e interno',
    category: 'CRITICO',
  },
  { name: '13', label: 'Cinto de segurança', category: 'CRITICO' },
  {
    name: '19',
    label: 'Sistema de telemetria / sensor de fadiga',
    category: 'CRITICO',
  },
  {
    name: '20',
    label:
      'Documentos do veículo (Renavan, DUT, IPVA, Licenciamento, Seguro obrigatório, CNH, etc)',
    category: 'CRITICO',
  },
]

const nonCriticalChecklistItems: ChecklistItem[] = [
  {
    name: '02',
    label: 'Buzina / sinal sonoro de ré / sinal luminoso de ré',
    category: 'NAO_CRITICO',
  },
  {
    name: '15',
    label: 'Ar-condicionado em perfeito funcionamento',
    category: 'NAO_CRITICO',
  },
  {
    name: '16',
    label: 'Condições gerais de limpeza (interna e externa)',
    category: 'NAO_CRITICO',
  },
  {
    name: '18',
    label: 'Nível de óleo do motor, água do radiador e fluído de freio',
    category: 'NAO_CRITICO',
  },
]

const vehicleChecklistItems = [...criticalChecklistItems, ...nonCriticalChecklistItems]

const fatigueQuestions = [
  { name: '31', label: 'Dormiu menos de 8h?' },
  { name: '32', label: 'Está com sonolência?' },
  { name: '33', label: 'Está se sentindo mal?' },
  { name: '34', label: 'Está com problema estomacal?' },
  { name: '35', label: 'Está com preocupações?' },
  { name: '36', label: 'Está se sentindo estressado?' },
  { name: '37', label: 'Vai dirigir sozinho/sem rádio?' },
  { name: '38', label: 'Ingeriu bebida alcoólica nas últimas 8h?' },
  { name: '39', label: 'Tomou medicamento nas últimas 8h?' },
  { name: '40', label: 'Está com dificuldade de adaptação?' },
]

const criticalOptions = [
  { value: '', label: '' },
  { value: 'OK', label: 'Ok' },
  { value: 'COM_PROBLEMA', label: 'Com problema' },
]

const nonCriticalOptions = [
  { value: 'OK', label: 'Ok' },
  { value: 'COM_PROBLEMA', label: 'Com problema' },
  { value: 'NAO_SE_APLICA', label: 'Não se aplica' },
]

type SubmissionResult = {
  vehicleStatus: 'RESTRITO' | 'DISPONIVEL'
  driverStatus: 'APTO' | 'INAPTO'
  fatigueScore: number
  fatigueRisk: 'LEVE' | 'TOLERAVEL' | 'GRAVE'
}

export default function VehicleCheckinPage() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [plateInput, setPlateInput] = useState('')
  const [vehicleExists, setVehicleExists] = useState<boolean | null>(null)
  const [lastKm, setLastKm] = useState<number | null>(null)
  const [vehicleStatus, setVehicleStatus] = useState<string | null>(null)
  const [costCenters, setCostCenters] = useState<Array<{ id: string; label: string }>>([])
  const [allCostCenters, setAllCostCenters] = useState<Array<{ id: string; label: string }>>([])
  const [vehicleCostCenters, setVehicleCostCenters] = useState<Array<{ id: string; label: string }>>([])
  const [costCenterInput, setCostCenterInput] = useState('')
  const [costCenterId, setCostCenterId] = useState<string | undefined>()
  const [vehicleType, setVehicleType] = useState('VEICULO_LEVE')
  const [driverName, setDriverName] = useState('')
  const [success, setSuccess] = useState<string | null>(null)

  const checklistInitialState = useMemo(
    () =>
      vehicleChecklistItems.reduce<Record<string, string>>((acc, item) => {
        acc[item.name] = ''
        return acc
      }, {}),
    []
  )

  const fatigueInitialState = useMemo(
    () =>
      fatigueQuestions.reduce<Record<string, string>>((acc, item) => {
        acc[item.name] = ''
        return acc
      }, {}),
    []
  )

  const [fatigueOptionsVisible, setFatigueOptionsVisible] = useState<Record<string, boolean>>(() =>
    fatigueQuestions.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.name] = false
      return acc
    }, {})
  )


  useEffect(() => {
    async function loadCostCenters() {
      try {
        const res = await fetch('/api/cost-centers/select', { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao buscar centros de custo')
        const data: Array<{
          id: string
          description: string
          externalCode: string | null
        }> = await res.json()

        const mapped = data.map((cc) => ({
          id: cc.id,
          label: `${cc.externalCode ? `${cc.externalCode} - ` : ''}${cc.description}`,
        }))

        setCostCenters(mapped)
        setAllCostCenters(mapped)
      } catch (err) {
        console.error(err)
        setCostCenters([])
        setAllCostCenters([])
      }
    }

    loadCostCenters()
  }, [])

  useEffect(() => {
    const match = costCenters.find(
      (cc) => cc.label.toLowerCase() === costCenterInput.trim().toLowerCase()
    )
    setCostCenterId(match?.id)
  }, [costCenterInput, costCenters])

  useEffect(() => {
    if (vehicleCostCenters.length > 0) {
      setCostCenters(vehicleCostCenters)
    } else {
      setCostCenters(allCostCenters)
    }
  }, [vehicleCostCenters, allCostCenters])

  useEffect(() => {
    async function checkVehicle(plate: string) {
      setVehicleExists(null)
      setLastKm(null)
      setVehicleStatus(null)
      setVehicleCostCenters([])
      setVehicleType('VEICULO_LEVE')

      try {
        const res = await fetch(`/api/fleet/vehicles?plate=${encodeURIComponent(plate)}`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Erro ao buscar veículo')

        const vehicles: Array<{
          plate: string
          kmCurrent?: number
          status?: string | null
          type?: string | null
          costCenters?: Array<{
            costCenter?: {
              id: string
              externalCode?: string | null
              description?: string | null
            } | null
          }>
        }> = await res.json()

        const found = vehicles.find((v) => v.plate.toUpperCase() === plate)
        setVehicleExists(Boolean(found))
        setLastKm(found?.kmCurrent ?? null)
        setVehicleStatus(found?.status ?? null)
        setVehicleType(found?.type ?? 'VEICULO_LEVE')

        const vehicleCenters =
          found?.costCenters
            ?.map((link) => link.costCenter)
            .filter(Boolean)
            .map((cc) => ({
              id: (cc as { id: string }).id,
              label: `${(cc as { externalCode?: string | null }).externalCode ? `${(cc as {
                externalCode?: string | null
              }).externalCode} - ` : ''}${(cc as { description?: string | null }).description ?? ''}`.trim(),
            })) ?? []

        setVehicleCostCenters(vehicleCenters)
      } catch (err) {
        console.error(err)
        setVehicleExists(false)
        setLastKm(null)
        setVehicleCostCenters([])
      }
    }

    const normalizedPlate = plateInput.trim().toUpperCase()
    if (isValidPlate(normalizedPlate)) {
      checkVehicle(normalizedPlate)
    } else {
      setVehicleExists(null)
      setLastKm(null)
      setVehicleType('VEICULO_LEVE')
    }
  }, [plateInput])

  useEffect(() => {
    async function loadDriver() {
      try {
        const res = await fetch('/api/session/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setDriverName(data?.appUser?.fullName ?? '')
      } catch (err) {
        console.error(err)
      }
    }

    loadDriver()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const normalizedPlate = plateInput.trim().toUpperCase()

   if (!isValidPlate(normalizedPlate)) {
      setError('Informe uma placa no formato ABC1A34 (Mercosul) ou ABC1234 (antiga)')
      return
    }

    if (vehicleExists === false) {
      setError('A placa informada não está cadastrada no sistema')
      return
    }

    if (costCenterInput && !costCenterId) {
      setError('Selecione um centro de custo válido da lista')
      return
    }

    setSubmitting(true)
    setError(null)
    setResult(null)
    setSuccess(null)

    if (typeof window === 'undefined' || typeof window.FormData === 'undefined') {
      setSubmitting(false)
      setError('Não foi possível enviar o formulário neste navegador.')
      return
    }

    const formData = new window.FormData(form)
    const missingChecklistItem = vehicleChecklistItems.find(
      (item) => (formData.get(`checklist-${item.name}`) as string | null)?.trim() === ''
    )

    if (missingChecklistItem) {
      setError(`Selecione uma opção para o item "${missingChecklistItem.label}".`)
      setSubmitting(false)
      return
    }

const vehicleKmRaw = formData.get('vehicleKm')
    const vehicleKmConfirmationRaw = formData.get('vehicleKmConfirmation')

    const vehicleKm = Number(vehicleKmRaw ?? 0)
    const vehicleKmConfirmation = Number(vehicleKmConfirmationRaw ?? 0)

    if (!Number.isFinite(vehicleKm) || vehicleKm <= 0) {
      setError('Informe uma quilometragem válida.')
      setSubmitting(false)
      return
    }

    if (!Number.isFinite(vehicleKmConfirmation) || vehicleKmConfirmation <= 0) {
      setError('Confirme uma quilometragem válida.')
      setSubmitting(false)
      return
    }

    if (vehicleKm !== vehicleKmConfirmation) {
      setError('As quilometragens informadas não coincidem.')
      setSubmitting(false)
      return
    }

    // Regra básica: não pode ser menor que a última (backend também deve validar)
    if (typeof lastKm === 'number' && vehicleKm < lastKm) {
      setError(`A quilometragem informada (${vehicleKm.toLocaleString('pt-BR')}) é menor que a última registrada (${lastKm.toLocaleString('pt-BR')}).`)
      setSubmitting(false)
      return
    }

    // Regra anti "0 a mais": se for 10x maior, pede confirmação extra (aqui só bloqueando)
    if (typeof lastKm === 'number' && lastKm > 0 && vehicleKm >= lastKm * 10) {
      setError('Quilometragem muito acima do último registro (possível zero a mais). Verifique e tente novamente.')
      setSubmitting(false)
      return
    }

    if (vehicleKm !== vehicleKmConfirmation) {
      setError('As quilometragens informadas não coincidem.')
      setSubmitting(false)
      return
    }

    const vehicleChecklist = vehicleChecklistItems.map((item) => ({
      name: item.name,
      label: item.label,
      category: item.category,
      status: (() => {
        const value = formData.get(`checklist-${item.name}`) as string | null
        return value && value !== '' ? value : 'OK'
      })(),
    }))

    const hasCriticalIssue = vehicleChecklist.some(
      (item) => item.category === 'CRITICO' && item.status === 'COM_PROBLEMA'
    )
    const treatmentActions = (formData.get('nonConformityActions') as string) || ''
    const treatmentDate = (formData.get('nonConformityHandlingDate') as string) || ''

    const vehicleWasRestricted = (vehicleStatus ?? '').toUpperCase() === 'RESTRITO'
    const willBeReleased = !hasCriticalIssue

    if (vehicleWasRestricted && willBeReleased) {
      if (!treatmentActions.trim() || !treatmentDate) {
        setError('Informe as tratativas e a data da tratativa para liberar um veículo restrito.')
        setSubmitting(false)
        return
      }
    }

    const fatigue = fatigueQuestions.map((item) => ({
      name: item.name,
      label: item.label,
      answer: (formData.get(`fatigue-${item.name}`) as string) || 'NAO',
    }))

    const payload = {
      inspectionDate: formData.get('inspectionDate'),
      inspectionTime: formData.get('inspectionTime'),
      costCenter: costCenterInput || undefined,
      sectorActivity: undefined,
      driverName: formData.get('driverName'),
      vehicleType: formData.get('vehicleType'),
      vehiclePlate: normalizedPlate,
      vehicleKm,
      vehicleChecklist,
      fatigue,
      hasNonConformity: hasCriticalIssue ? 'SIM' : 'NAO',
      nonConformityCriticality: hasCriticalIssue ? 'ALTA' : undefined,
      nonConformityActions:
        treatmentActions.trim() ||
        (hasCriticalIssue ? 'Veículo paralisado até manutenção do item crítico.' : undefined),
      nonConformityManager: undefined,
      nonConformityHandlingDate: treatmentDate || undefined,
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

      const data: SubmissionResult = await res.json()
      setResult(data)
      form.reset()
      setPlateInput('')
      setVehicleExists(null)
      setLastKm(null)
      setCostCenterInput('')
      setVehicleCostCenters([])
      setVehicleStatus(null)
      setVehicleType('VEICULO_LEVE')
      setSuccess('Check-in concluído com sucesso!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <header className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Gestão de Frotas</p>
            <h1 className="text-2xl font-bold text-slate-900">Checklist diário</h1>
          </div>
          <a
            href="/dashboard/gestao-de-frotas/checkins/registro-rapido"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Check-in rápido
          </a>
        </div>
        <p className="text-sm text-slate-600">
          Formulário otimizado para celular: preencha, valide itens críticos e registre o controle de fadiga.
          O cálculo retorna automaticamente veículo liberado/restrito e motorista apto/inapto.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Etapa 1</p>
            <h2 className="text-lg font-semibold text-slate-900">Dados da inspeção</h2>
            <p className="text-xs text-slate-500">Informações essenciais do condutor e veículo.</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Data da inspeção
              <input
                required
                name="inspectionDate"
                type="date"
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Horário
              <input
                name="inspectionTime"
                type="time"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Placa do veículo
              <input
                required
                name="vehiclePlate"
                type="text"
                placeholder="ABC1A34 ou ABC1234"
                pattern="[A-Z]{3}[0-9][A-Z0-9][0-9]{2}"
                value={plateInput}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  setPlateInput(value.slice(0, 7))
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase focus:border-slate-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">Digite apenas placas já cadastradas no sistema.</span>
              {vehicleExists !== null && (
                <span
                  className={`text-xs font-medium ${
                    vehicleExists ? 'text-green-700' : 'text-orange-700'
                  }`}
                >
                  {vehicleExists
                    ? 'Veículo localizado e pronto para check-in'
                    : 'Placa não cadastrada. Cadastre o veículo antes de usar.'}
                </span>
              )}
              {vehicleStatus && (
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    vehicleStatus === 'RESTRITO'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  Status atual: {vehicleStatus}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Quilometragem atual
              <input
                required
                name="vehicleKm"
                type="number"
                min={lastKm ?? 0}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">
                Última quilometragem registrada:{' '}
                {lastKm !== null ? lastKm.toLocaleString('pt-BR') : '—'} km
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Confirme a quilometragem
              <input
                required
                name="vehicleKmConfirmation"
                type="number"
                min={lastKm ?? 0}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">Repita a quilometragem para evitar erros de digitação.</span>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Centro de custo
              <input
                name="costCenter"
                list="cost-center-options"
                value={costCenterInput}
                onChange={(event) => setCostCenterInput(event.target.value)}
                placeholder="Digite para buscar"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <datalist id="cost-center-options">
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.label} />
                ))}
              </datalist>
              <span className="text-xs text-slate-500">
                Selecione uma opção cadastrada (cód. externo - nome).
              </span>
              {costCenterInput && !costCenterId && (
                <span className="text-xs text-orange-700">Centro de custo inválido.</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nome do motorista
              <input
                required
                name="driverName"
                type="text"
                value={driverName}
                readOnly
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Tipo de veículo
              <select
                name="vehicleType"
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                <option value="VEICULO_LEVE">Veículo leve</option>
                <option value="4X4">4x4</option>
                <option value="SUV">SUV</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-red-500">Etapa 2A</p>
              <h2 className="text-lg font-semibold text-red-800">
                Itens críticos (paralisar se houver problema)
              </h2>
              <p className="text-xs text-red-700">
                Qualquer item abaixo com “Com problema” torna o veículo automaticamente{' '}
                <strong>não conforme</strong> e deve ser paralisado até manutenção.
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {criticalChecklistItems.map((item) => (
                <label
                  key={item.name}
                  className="flex flex-col gap-1 rounded-xl border border-red-100 bg-white p-3 text-sm font-medium text-red-900 shadow-sm"
                >
                  <span className="flex items-start justify-between gap-2 text-red-800">
                    <span>{item.label}</span>
                    <span className="text-xs font-semibold text-red-500">#{item.name}</span>
                  </span>
                  <select
                    name={`checklist-${item.name}`}
                    defaultValue={checklistInitialState[item.name]}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {criticalOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Etapa 2B</p>
              <h2 className="text-lg font-semibold text-slate-900">
                Itens não críticos (programar manutenção)
              </h2>
              <p className="text-xs text-slate-600">
                Marque “Programar manutenção” para itens que precisam de ajuste mas não paralisam o
                veículo.
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {nonCriticalChecklistItems.map((item) => (
                <label
                  key={item.name}
                  className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 shadow-sm"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="text-xs font-semibold text-slate-500">#{item.name}</span>
                  </span>
                  <select
                    name={`checklist-${item.name}`}
                    defaultValue={checklistInitialState[item.name]}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {nonCriticalOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-slate-500">Etapa 3</p>
            <h2 className="text-lg font-semibold text-slate-900">Controle de fadiga</h2>
            <p className="text-xs text-slate-600">
              Respostas alimentam o cálculo automático e indicam se o condutor está apto ou inapto.
            </p>
          </div>

          <div className="mt-3 space-y-3">
            {fatigueQuestions.map((item) => (
              <label
                key={item.name}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 shadow-sm"
              >
                <span className="flex items-start justify-between gap-2">
                  <span>{item.label}</span>
                  <span className="text-xs font-semibold text-slate-500">#{item.name}</span>
                </span>
                <select
                  name={`fatigue-${item.name}`}
                  defaultValue={fatigueInitialState[item.name]}
                   onFocus={() =>
                    setFatigueOptionsVisible((prev) => ({
                      ...prev,
                      [item.name]: true,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {fatigueOptionsVisible[item.name] && (
                    <>
                      <option value="NAO">Não</option>
                      <option value="SIM">Sim</option>
                    </>
                  )}
                </select>
              </label>
            ))}
          </div>
        </section>
        {vehicleStatus === 'RESTRITO' && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-orange-200">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-orange-500">Liberação de veículo restrito</p>
              <h2 className="text-lg font-semibold text-orange-900">Informe as tratativas realizadas</h2>
              <p className="text-xs text-orange-700">
                Para liberar um veículo que estava restrito, registre a ação corretiva executada e a data da tratativa.
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Tratativas realizadas
                <textarea
                  name="nonConformityActions"
                  className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Ex.: manutenção realizada, peças trocadas, testes de rodagem"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Data da tratativa
                <input
                  type="date"
                  name="nonConformityHandlingDate"
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </label>
            </div>
          </section>
        )}


        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 shadow-sm">
          Itens críticos com problema geram não conformidade automática e orientam a paralisação do
          veículo. O controle de fadiga calcula a condição do condutor ao enviar o formulário.
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full justify-center rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-75"
          >
            {submitting ? 'Enviando...' : 'Enviar check-in'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}
          
        </div>
      </form>

      {result && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase text-slate-500">Retorno do checklist</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Status do veículo</p>
              <p className="text-lg font-semibold text-slate-900">{result.vehicleStatus}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Status do motorista</p>
              <p className="text-lg font-semibold text-slate-900">{result.driverStatus}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Pontuação de fadiga</p>
              <p className="text-lg font-semibold text-slate-900">{result.fatigueScore}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Risco de fadiga</p>
              <p className="text-lg font-semibold text-slate-900">{result.fatigueRisk}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
