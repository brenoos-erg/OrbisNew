'use client'

import { FormEvent, useMemo, useState } from 'react'

const vehicleChecklistItems = [
  { name: '9', label: 'Documentação e CRLV em dia' },
  { name: '10', label: 'Pneus calibrados e sem danos' },
  { name: '11', label: 'Estepe e triângulo' },
  { name: '12', label: 'Macaco e chave de roda' },
  { name: '13', label: 'Freios (pedal e estacionamento)' },
  { name: '14', label: 'Luzes dianteiras e traseiras' },
  { name: '15', label: 'Setas e pisca-alerta' },
  { name: '16', label: 'Limpador e lavador de para-brisa' },
  { name: '17', label: 'Nível de combustível' },
  { name: '18', label: 'Nível de óleo do motor' },
  { name: '19', label: 'Nível de água/radiador' },
  { name: '20', label: 'Painel de instrumentos sem alertas' },
  { name: '21', label: 'Cintos de segurança' },
  { name: '22', label: 'Buzina' },
  { name: '23', label: 'Retrovisores e espelhos' },
  { name: '24', label: 'Portas e travas' },
  { name: '25', label: 'Vidros e para-brisa' },
  { name: '26', label: 'Assentos e apoios de cabeça' },
  { name: '27', label: 'Ar-condicionado/ventilação' },
  { name: '28', label: 'Limpeza interna/externa' },
  { name: '29', label: 'Ruídos ou vibrações anormais' },
  { name: '30', label: 'Observações gerais' },
]

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

  const checklistInitialState = useMemo(
    () =>
      vehicleChecklistItems.reduce<Record<string, string>>((acc, item) => {
        acc[item.name] = 'OK'
        return acc
      }, {}),
    []
  )

  const fatigueInitialState = useMemo(
    () =>
      fatigueQuestions.reduce<Record<string, string>>((acc, item) => {
        acc[item.name] = 'NAO'
        return acc
      }, {}),
    []
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)

    const formData = new FormData(event.currentTarget)
    const vehicleChecklist = vehicleChecklistItems.map((item) => ({
      name: item.name,
      label: item.label,
      status: (formData.get(`checklist-${item.name}`) as string) || 'OK',
    }))

    const fatigue = fatigueQuestions.map((item) => ({
      name: item.name,
      label: item.label,
      answer: (formData.get(`fatigue-${item.name}`) as string) || 'NAO',
    }))

    const payload = {
      inspectionDate: formData.get('inspectionDate'),
      inspectionTime: formData.get('inspectionTime'),
      costCenter: formData.get('costCenter'),
      sectorActivity: formData.get('sectorActivity'),
      driverName: formData.get('driverName'),
      vehicleType: formData.get('vehicleType'),
      vehiclePlate: (formData.get('vehiclePlate') as string | null)?.toUpperCase(),
      vehicleKm: Number(formData.get('vehicleKm') ?? 0),
      vehicleChecklist,
      fatigue,
      hasNonConformity: formData.get('hasNonConformity'),
      nonConformityCriticality: formData.get('nonConformityCriticality'),
      nonConformityActions: formData.get('nonConformityActions'),
      nonConformityManager: formData.get('nonConformityManager'),
      nonConformityHandlingDate: formData.get('nonConformityHandlingDate'),
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
      event.currentTarget.reset()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Checklist de veículos</h1>
       <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-slate-600 max-w-3xl">
            Preencha os dados da inspeção diária, valide os itens do veículo e registre o controle de fadiga. O
            processamento calcula automaticamente o status do veículo e do motorista.
          </p>
          <a
            href="/dashboard/gestao-de-frotas/checkins/registro-rapido"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Abrir check-in rápido
          </a>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Seção 1</p>
            <h2 className="text-xl font-semibold text-slate-900">Dados da inspeção</h2>
            <p className="text-sm text-slate-600">Informações do veículo e do colaborador.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Data da inspeção
              <input required name="inspectionDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Horário
              <input name="inspectionTime" type="time" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Centro de custo
              <input name="costCenter" type="text" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Setor / atividade
              <input name="sectorActivity" type="text" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nome do motorista
              <input required name="driverName" type="text" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Tipo de veículo
              <select name="vehicleType" defaultValue="VEICULO_LEVE" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none">
                <option value="VEICULO_LEVE">Veículo leve</option>
                <option value="4X4">4x4</option>
                <option value="SUV">SUV</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Placa do veículo
              <input required name="vehiclePlate" type="text" placeholder="ABC1234" className="rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-slate-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Quilometragem atual
              <input required name="vehicleKm" type="number" min={0} className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Seção 2</p>
            <h2 className="text-xl font-semibold text-slate-900">Itens de verificação do veículo</h2>
            <p className="text-sm text-slate-600">Itens 9–30 do checklist.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {vehicleChecklistItems.map((item) => (
              <label key={item.name} className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                <span className="flex items-start justify-between gap-2">
                  <span>{item.label}</span>
                  <span className="text-xs font-semibold text-slate-400">#{item.name}</span>
                </span>
                <select
                  name={`checklist-${item.name}`}
                  defaultValue={checklistInitialState[item.name]}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                >
                  <option value="OK">OK</option>
                  <option value="COM_PROBLEMA">Com problema</option>
                  <option value="NAO_SE_APLICA">Não se aplica</option>
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Seção 3</p>
            <h2 className="text-xl font-semibold text-slate-900">Controle de fadiga</h2>
            <p className="text-sm text-slate-600">Itens 31–40. Respostas alimentam o cálculo automático.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {fatigueQuestions.map((item) => (
              <label key={item.name} className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                <span className="flex items-start justify-between gap-2">
                  <span>{item.label}</span>
                  <span className="text-xs font-semibold text-slate-400">#{item.name}</span>
                </span>
                <select
                  name={`fatigue-${item.name}`}
                  defaultValue={fatigueInitialState[item.name]}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                >
                  <option value="NAO">Não</option>
                  <option value="SIM">Sim</option>
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Seção 4</p>
            <h2 className="text-xl font-semibold text-slate-900">Não conformidades</h2>
            <p className="text-sm text-slate-600">Informe se existe alguma não conformidade e os detalhes.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Há não conformidade?
              <select
                name="hasNonConformity"
                defaultValue="NAO"
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              >
                <option value="NAO">Não</option>
                <option value="SIM">Sim</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Criticidade
              <select
                name="nonConformityCriticality"
                defaultValue=""
                className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              >
                <option value="">Selecione</option>
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Ações corretivas
              <textarea
                name="nonConformityActions"
                className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Responsável/gestor
              <input name="nonConformityManager" type="text" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Prazo / data de tratativa
              <input name="nonConformityHandlingDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
            </label>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full justify-center rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-75 md:w-auto"
          >
            {submitting ? 'Enviando...' : 'Enviar check-in'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Retorno do checklist</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
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