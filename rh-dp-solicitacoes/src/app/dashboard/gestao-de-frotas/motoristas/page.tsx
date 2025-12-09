'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, ClipboardList, FileDown } from 'lucide-react'

type CostCenter = {
  id: string
  name: string
  code: string
  externalCode: string
  sigla: string
  status: 'ACTIVE' | 'INACTIVE'
}

type Driver = {
  id: string
  name: string
  costCenterId: string
  lastScore: number
  monthlyAnswers: Record<number, Record<string, 'SIM' | 'NAO'>>
}
type Question = {
  id: string
  label: string
  weight: number
}

const costCenters: CostCenter[] = [
  { id: 'cc1', name: 'Campo', code: '141', externalCode: '555', sigla: 'EXT', status: 'ACTIVE' },
  { id: 'cc2', name: 'Matriz', code: '099', externalCode: '450', sigla: 'MTZ', status: 'ACTIVE' },
]

const questions: Question[] = [
  { id: 'q1', label: 'Dormiu menos de 8 horas', weight: 5 },
  { id: 'q2', label: 'Está com sonolência', weight: 5 },
  { id: 'q3', label: 'Está se sentindo mal', weight: 10 },
  { id: 'q4', label: 'Está com problema estomacal', weight: 10 },
  { id: 'q5', label: 'Está com preocupações pessoais', weight: 5 },
  { id: 'q6', label: 'Está se sentindo estressado', weight: 10 },
  { id: 'q7', label: 'Está subindo e descendo a toda hora', weight: 10 },
  { id: 'q8', label: 'Ingeriu bebida alcoólica há menos de 8 horas', weight: 20 },
  { id: 'q9', label: 'Ingeriu medicamento há menos de 8 horas', weight: 20 },
  { id: 'q10', label: 'Dificuldade de adaptação ao uso deste veículo', weight: 5 },
]

const initialDrivers: Driver[] = [
  {
    id: '1',
    name: 'Marcos Silva',
    costCenterId: 'cc1',
    lastScore: 18,
    monthlyAnswers: {
      1: { q1: 'SIM', q2: 'NAO', q3: 'NAO', q8: 'NAO' },
      2: { q1: 'NAO', q5: 'SIM', q6: 'SIM' },
      3: { q2: 'SIM', q3: 'SIM', q4: 'SIM', q10: 'NAO' },
      4: { q8: 'SIM', q9: 'SIM', q2: 'SIM' },
      5: { q1: 'NAO', q4: 'NAO' },
    },
  },
  {
    id: '2',
    name: 'Patrícia Gomes',
    costCenterId: 'cc1',
    lastScore: 12,
    monthlyAnswers: {
      1: { q1: 'NAO', q2: 'NAO', q3: 'NAO' },
      2: { q6: 'SIM', q5: 'NAO' },
      3: { q1: 'SIM', q8: 'NAO' },
      4: { q1: 'NAO', q2: 'NAO', q3: 'NAO', q4: 'NAO' },
    },
  },
  {
    id: '3',
    name: 'Renato Costa',
    costCenterId: 'cc2',
    lastScore: 32,
    monthlyAnswers: {
      1: { q2: 'SIM', q3: 'SIM', q8: 'SIM', q9: 'SIM' },
      2: { q1: 'SIM', q4: 'SIM', q6: 'SIM' },
    },
  },
]

const days = Array.from({ length: 31 }, (_, index) => index + 1)

function getRisk(score: number) {
  if (score < 20) return { risk: 'Risco leve', status: 'APTO', color: 'text-green-700 bg-green-50' }
  if (score < 30) return { risk: 'Risco tolerável', status: 'APTO', color: 'text-amber-700 bg-amber-50' }
  return { risk: 'Risco grave', status: 'INAPTO', color: 'text-red-700 bg-red-50' }
}

function getDayScore(dayAnswers: Record<string, 'SIM' | 'NAO'> | undefined) {
  if (!dayAnswers) return 0
  return questions.reduce((total, question) => {
    const answeredYes = dayAnswers[question.id] === 'SIM'
    return total + (answeredYes ? question.weight : 0)
  }, 0)
}

export default function DriversPage() {
  const [selectedCostCenter, setSelectedCostCenter] = useState(costCenters[0].id)
  const [selectedDriver, setSelectedDriver] = useState(initialDrivers[0].id)
  const [selectedMonth] = useState('Setembro/2024')
  const [driverAnswers, setDriverAnswers] = useState<
    Record<string, Record<number, Record<string, 'SIM' | 'NAO'>>>
  >(() => Object.fromEntries(initialDrivers.map((driver) => [driver.id, driver.monthlyAnswers])))

  const filteredDrivers = useMemo(
    () => initialDrivers.filter((driver) => driver.costCenterId === selectedCostCenter),
    [selectedCostCenter]
  )

  useEffect(() => {
    if (!filteredDrivers.find((driver) => driver.id === selectedDriver) && filteredDrivers[0]) {
      setSelectedDriver(filteredDrivers[0].id)
    }
  }, [filteredDrivers, selectedDriver])

  const currentDriver = filteredDrivers.find((driver) => driver.id === selectedDriver) || filteredDrivers[0]
  const currentAnswers = currentDriver ? driverAnswers[currentDriver.id] || {} : {}

  const latestDayWithData = useMemo(() => {
    const daysWithData = Object.keys(currentAnswers).map((day) => Number(day))
    return daysWithData.length ? Math.max(...daysWithData) : 1
  }, [currentAnswers])

  const dayScore = getDayScore(currentAnswers[latestDayWithData])
  const riskInfo = getRisk(dayScore)

  function handleAnswer(day: number, questionId: string, value: 'SIM' | 'NAO') {
    if (!currentDriver) return
    setDriverAnswers((prev) => {
      const driverData = prev[currentDriver.id] || {}
      const dayData = driverData[day] || {}
      return {
        ...prev,
        [currentDriver.id]: {
          ...driverData,
          [day]: {
            ...dayData,
            [questionId]: value,
          },
        },
      }
    })
  }

  function handleGenerateForm() {
    if (!currentDriver) return
    setDriverAnswers((prev) => ({
      ...prev,
      [currentDriver.id]: {},
    }))
  }

  const costCenterInfo = costCenters.find((center) => center.id === selectedCostCenter)

  const summary = useMemo(() => {
    const totals = { aptos: 0, inaptos: 0 }
    filteredDrivers.forEach((driver) => {
      const latestDay = Object.keys(driverAnswers[driver.id] || {})
        .map((day) => Number(day))
        .sort((a, b) => b - a)[0]
      const score = getDayScore(driverAnswers[driver.id]?.[latestDay || 0])
      const status = getRisk(score).status
      if (status === 'APTO') totals.aptos += 1
      else totals.inaptos += 1
    })
    return totals
  }, [driverAnswers, filteredDrivers])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Controle de motoristas</h1>
        <p className="text-slate-600 max-w-4xl text-sm">
          Visualize os motoristas vinculados ao centro de custo selecionado, acompanhe o status de aptidão e gere o
          formulário mensal de controle de fadiga. Cada dia do mês possui um campo para respostas rápidas; "Sim" marca um
          "S" e soma pontos, enquanto "Não" marca um "N" sem pontuação.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-orange-500" size={18} />
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Centro de custo</p>
              <h2 className="text-lg font-semibold text-slate-900">Seleção</h2>
            </div>
          </div>

          <select
            value={selectedCostCenter}
            onChange={(event) => setSelectedCostCenter(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            {costCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name} • Código {center.code}
              </option>
            ))}
          </select>

          {costCenterInfo && (
            <div className="rounded-lg border border-slate-200 p-3 text-sm bg-slate-50">
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">{costCenterInfo.name}</span>
                <span className="text-xs rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">
                  {costCenterInfo.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Código interno: {costCenterInfo.code}</p>
              <p className="text-xs text-slate-500">Código externo: {costCenterInfo.externalCode}</p>
              <p className="text-xs text-slate-500">Sigla: {costCenterInfo.sigla}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs text-green-700">Motoristas aptos</p>
              <p className="text-2xl font-bold text-green-800">{summary.aptos}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Motoristas inaptos</p>
              <p className="text-2xl font-bold text-red-800">{summary.inaptos}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Motoristas do centro</p>
            <div className="space-y-2">
              {filteredDrivers.map((driver) => {
                const latestDay = Object.keys(driverAnswers[driver.id] || {})
                  .map((day) => Number(day))
                  .sort((a, b) => b - a)[0]
                const score = getDayScore(driverAnswers[driver.id]?.[latestDay || 0])
                const risk = getRisk(score)
                const isSelected = driver.id === currentDriver?.id
                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => setSelectedDriver(driver.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 text-orange-800'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{driver.name}</span>
                      <span
                        className={`text-2xs rounded-full px-2 py-0.5 font-semibold ${
                          risk.status === 'APTO'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {risk.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Pontuação mais recente: {score} pts</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Formulário mensal</p>
              <h2 className="text-xl font-semibold text-slate-900">Controle de fadiga ({selectedMonth})</h2>
              {currentDriver && <p className="text-sm text-slate-600">{currentDriver.name}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => document.getElementById('formulario-diario')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-200"
              >
                <CalendarDays size={16} /> Visualizar formulário
              </button>
              <button
                type="button"
                onClick={handleGenerateForm}
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
              >
                <FileDown size={16} /> Gerar formulário do mês
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Pontuação atual</p>
              <p className="text-3xl font-bold text-slate-900">{dayScore} pts</p>
              <div className={`rounded-lg p-3 text-sm font-semibold ${riskInfo.color}`}>{riskInfo.risk}</div>
              <p className="text-xs text-slate-600">Calculada com base no último dia preenchido do mês.</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Critério</p>
              <p className="text-sm text-slate-700">Apto abaixo de 30 pontos. Inapto a partir de 30 pontos (risco grave).</p>
              <p className="text-xs text-slate-500">Use a matriz diária para registrar S/N por pergunta.</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Centro vinculado</p>
              <p className="text-sm text-slate-700">{costCenterInfo?.name}</p>
              <p className="text-xs text-slate-500">Código {costCenterInfo?.code} • Externo {costCenterInfo?.externalCode}</p>
              <p className="text-xs text-slate-500">Sigla {costCenterInfo?.sigla}</p>
            </div>
          </div>

          <div id="formulario-diario" className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[900px] table-fixed border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="w-1/3 px-4 py-3 text-left text-sm font-semibold text-slate-700">Perguntas do dia</th>
                  <th className="w-20 px-4 py-3 text-left text-sm font-semibold text-slate-700">Pts (Sim)</th>
                  {days.map((day) => (
                    <th key={`head-${day}`} className="px-2 py-3 text-center text-xs font-semibold text-slate-600">
                      Dia {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {questions.map((question) => (
                  <tr key={question.id} className="border-t border-slate-200">
                    <td className="px-4 py-2 text-sm text-slate-800">{question.label}</td>
                    <td className="px-4 py-2 text-center text-sm font-semibold text-slate-700">{question.weight}</td>
                    {days.map((day) => {
                      const dayAnswer = currentAnswers[day]?.[question.id]
                      return (
                        <td key={`${question.id}-${day}`} className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAnswer(day, question.id, 'SIM')}
                              className={`h-7 w-7 rounded-md border text-xs font-bold transition ${
                                dayAnswer === 'SIM'
                                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              S
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAnswer(day, question.id, 'NAO')}
                              className={`h-7 w-7 rounded-md border text-xs font-bold transition ${
                                dayAnswer === 'NAO'
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              N
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-4 py-2 text-sm font-semibold text-slate-800" colSpan={2}>
                    Total do dia
                  </td>
                  {days.map((day) => {
                    const total = getDayScore(currentAnswers[day])
                    const risk = getRisk(total)
                    return (
                      <td key={`total-${day}`} className="px-2 py-2 text-center text-xs font-semibold">
                        <div className={`rounded-md px-2 py-1 ${risk.color}`}>{total} pts</div>
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
            <AlertTriangle size={18} className="mt-0.5" />
            <div>
              <p className="font-semibold">Critérios para permissão de dirigir</p>
              <p>
                Apto até 29 pontos (risco leve/tolerável). Inapto a partir de 30 pontos (risco grave). Use o painel para
                registrar o questionário diário e manter histórico de 31 dias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}