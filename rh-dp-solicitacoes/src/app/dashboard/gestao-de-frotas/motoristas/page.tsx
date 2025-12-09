'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, ClipboardList, FileDown, SlidersHorizontal, X } from 'lucide-react'

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
   const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(31)
  const [showForm, setShowForm] = useState(false)
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
   useEffect(() => {
    if (startDay > endDay) {
      setEndDay(startDay)
    }
  }, [endDay, startDay])


  const currentDriver = filteredDrivers.find((driver) => driver.id === selectedDriver) || filteredDrivers[0]
  const currentAnswers = currentDriver ? driverAnswers[currentDriver.id] || {} : {}
  const visibleDays = useMemo(() => days.filter((day) => day >= startDay && day <= endDay), [endDay, startDay])


  const latestDayWithData = useMemo(() => {
    const daysWithData = Object.keys(currentAnswers)
      .map((day) => Number(day))
      .filter((day) => day >= startDay && day <= endDay)
    return daysWithData.length ? Math.max(...daysWithData) : endDay
  }, [currentAnswers, endDay, startDay])

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

  function handleDownloadMonthlyReport() {
    if (!currentDriver) return
    const statusRow = visibleDays
      .map((day) => {
        const total = getDayScore(currentAnswers[day])
        const status = getRisk(total).status === 'APTO' ? 'A' : 'I'
        return `<td>${status}</td>`
      })
      .join('')

    const pointsRow = visibleDays
      .map((day) => {
        const total = getDayScore(currentAnswers[day])
        return `<td>${total} pts</td>`
      })
      .join('')

    const answerRows = questions
      .map((question) => {
        const cells = visibleDays
          .map((day) => {
            const answer = currentAnswers[day]?.[question.id]
            if (!answer) return '<td>-</td>'
            return `<td>${answer === 'SIM' ? 'S' : 'N'}</td>`
          })
          .join('')
        return `<tr><td>${question.label}</td>${cells}</tr>`
      })
      .join('')

    const htmlContent = `<!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charSet="UTF-8" />
          <title>Relatório mensal - ${currentDriver.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            h2 { margin: 0 0 16px; font-size: 16px; color: #475569; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
            th { background: #f8fafc; font-weight: 600; }
            td:first-child, th:first-child { text-align: left; width: 260px; }
            tfoot td { font-weight: 700; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Controle mensal de fadiga</h1>
          <h2>${currentDriver.name} • ${selectedMonth}</h2>
          <table>
            <thead>
              <tr>
                <th>Perguntas</th>
                ${visibleDays.map((day) => `<th>${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${answerRows}
            </tbody>
            <tfoot>
              <tr><td>Status (I/A)</td>${statusRow}</tr>
              <tr><td>Pontuação do dia</td>${pointsRow}</tr>
            </tfoot>
          </table>
          <p style="margin-top: 12px; color: #475569;">S = Sim, N = Não, I = Inapto, A = Apto.</p>
        </body>
      </html>`

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const monthSlug = selectedMonth.replace(/[\s/]+/g, '-').toLowerCase()
    link.href = url
    link.download = `controle-fadiga-${currentDriver.name.replace(/\s+/g, '-').toLowerCase()}-${monthSlug}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  const costCenterInfo = costCenters.find((center) => center.id === selectedCostCenter)

  const summary = useMemo(() => {
    const totals = { aptos: 0, inaptos: 0 }
    filteredDrivers.forEach((driver) => {
      const availableDays = Object.keys(driverAnswers[driver.id] || {})
        .map((day) => Number(day))
        .filter((day) => day >= startDay && day <= endDay)
        .sort((a, b) => b - a)
      const latestDay = availableDays[0] || endDay
      const score = getDayScore(driverAnswers[driver.id]?.[latestDay])
      const status = getRisk(score).status
      if (status === 'APTO') totals.aptos += 1
      else totals.inaptos += 1
    })
    return totals
}, [driverAnswers, filteredDrivers, endDay, startDay])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Status dos motoristas</h1>
        <p className="text-slate-600 max-w-4xl text-sm">
          Visualize apenas o nome e o status (Apto/Inapto) dos motoristas. Use o filtro de dias para mudar a visão e abra
          o formulário sobreposto para editar respostas, ver pontos e baixar o relatório.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-orange-500" size={18} />
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Centro de custo</p>
              <h2 className="text-lg font-semibold text-slate-900">Selecione a visão</h2>
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
<div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="flex items-center gap-2 text-slate-700">
              <CalendarDays size={16} className="text-orange-500" /> Período visível
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-700">
              <label className="flex items-center gap-2">
                De
                <input
                  type="number"
                  min={1}
                  max={days.length}
                  value={startDay}
                  onChange={(event) => setStartDay(Math.max(1, Math.min(days.length, Number(event.target.value))))}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-orange-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                Até
                <input
                  type="number"
                  min={startDay}
                  max={days.length}
                  value={endDay}
                  onChange={(event) => setEndDay(Math.max(startDay, Math.min(days.length, Number(event.target.value))))}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-orange-500 focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[1, 8, 15, 22].map((start) => {
                  const end = Math.min(start + 6, days.length)
                  return (
                    <button
                      key={`${start}-${end}`}
                      type="button"
                      onClick={() => {
                        setStartDay(start)
                        setEndDay(end)
                      }}
                      className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                        startDay === start && endDay === end
                          ? 'border-orange-500 bg-white text-orange-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {start}–{end}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    setStartDay(1)
                    setEndDay(days.length)
                  }}
                  className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                    startDay === 1 && endDay === days.length
                      ? 'border-orange-500 bg-white text-orange-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Mês inteiro
                </button>
          
              </div>
            </div>

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
          </div>

           <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Motoristas</p>
                <h2 className="text-xl font-semibold text-slate-900">Nome e status</h2>
                <p className="text-xs text-slate-600">Selecione um motorista e abra o formulário completo quando precisar.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                disabled={!currentDriver}
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CalendarDays size={16} /> Abrir formulário
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredDrivers.map((driver) => {
                const availableDays = Object.keys(driverAnswers[driver.id] || {})
                  .map((day) => Number(day))
                  .filter((day) => day >= startDay && day <= endDay)
                  .sort((a, b) => b - a)
                const latestDay = availableDays[0] || endDay
                const score = getDayScore(driverAnswers[driver.id]?.[latestDay])
                const risk = getRisk(score)
                const isSelected = driver.id === currentDriver?.id

                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => setSelectedDriver(driver.id)}
                     className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left shadow-sm transition ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 text-orange-800'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                     <div className="space-y-1">
                      <p className="text-sm font-semibold">{driver.name}</p>
                      <p className="text-xs text-slate-500">Referência: dia {latestDay}</p>
                    </div>
                     <span
                      className={`text-2xs rounded-full px-3 py-1 font-semibold ${
                        risk.status === 'APTO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {risk.status}
                    </span>
                   </button>
                )
              })}
            </div>
          </div>

         {costCenterInfo && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Centro vinculado</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-900">{costCenterInfo.name}</span>
                <span className="text-2xs rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">{costCenterInfo.status}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Código interno: {costCenterInfo.code} • Externo {costCenterInfo.externalCode}</p>
              <p className="text-xs text-slate-500">Sigla: {costCenterInfo.sigla}</p>

            </div>
             {costCenterInfo && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Centro vinculado</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-900">{costCenterInfo.name}</span>
                <span className="text-2xs rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">{costCenterInfo.status}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Código interno: {costCenterInfo.code} • Externo {costCenterInfo.externalCode}</p>
              <p className="text-xs text-slate-500">Sigla: {costCenterInfo.sigla}</p>


          <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Formulário mensal</p>
                <h2 className="text-xl font-semibold text-slate-900">Controle de fadiga ({selectedMonth})</h2>
                {currentDriver && <p className="text-sm text-slate-600">{currentDriver.name}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadMonthlyReport}
                  className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                >
                  <FileDown size={16} /> Baixar documento filtrado
                </button>
              </div>

            </div>
            
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Situação do motorista</p>
                <p className="text-sm font-semibold text-slate-900">{currentDriver?.name}</p>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${riskInfo.color}`}>
                  <span className="h-2 w-2 rounded-full bg-current" /> {riskInfo.status} • {riskInfo.risk}
                </div>
                <p className="text-xs text-slate-500">Pontuação do dia {visibleDays[visibleDays.length - 1]}: {dayScore} pontos.</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Resumo do mês</p>
                <p className="text-sm text-slate-700">
                  Apto abaixo de 30 pontos. Inapto a partir de 30 pontos (risco grave). Registre S/N em cada dia.
                </p>
                <p className="text-xs text-slate-500">Pontuação do dia soma apenas respostas "Sim".</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Período ativo</p>
                <div className="text-sm text-slate-700">
                  Dias {startDay} a {endDay} visíveis.
                </div>
                <div className="text-xs text-slate-500">Ajuste o período na tela principal para mudar a visão e os cálculos.</div>
              </div>

            </div>
            
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-start gap-2 text-slate-700">
                <SlidersHorizontal size={16} className="mt-1 text-orange-500" />
                <div className="flex-1 space-y-1 text-xs">
                  <p className="text-sm font-semibold">Visão filtrada pelo período escolhido</p>
                  <p className="text-slate-600">O formulário abaixo já respeita o intervalo de dias definido na visão principal.</p>
                </div>
              </div>

            </div>

          <div id="formulario-diario" className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full table-fixed border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="w-1/3 px-4 py-3 text-left text-sm font-semibold text-slate-700">Perguntas do dia</th>
                    <th className="w-20 px-4 py-3 text-left text-sm font-semibold text-slate-700">Pts (Sim)</th>
                    {visibleDays.map((day) => (
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
                      {visibleDays.map((day) => {
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
                    {visibleDays.map((day) => {
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

           <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
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
    </div>
  )
}