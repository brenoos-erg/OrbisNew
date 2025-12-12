'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, ClipboardList, FileDown, SlidersHorizontal, UserRound } from 'lucide-react'

type CostCenter = {
  id: string
  name: string
  code: string
  externalCode: string
  sigla: string
  status: 'ACTIVE' | 'INACTIVE'
}
type MonthlyAnswers = Record<string, Record<number, Record<string, 'SIM' | 'NAO'>>>

type Driver = {
  id: string
  userId?: string
  name: string
  costCenterId: string
  assignment: 'motorista' | 'outro'
  lastScore: number
  monthlyAnswers: MonthlyAnswers
}
type UserDirectoryEntry = {
  id: string
  name: string
  email: string
  phone: string
  position: string
  costCenterId: string
  assignments: string[]
  avatarUrl?: string
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
    userId: 'u1',
    name: 'Marcos Silva',
    costCenterId: 'cc1',
    assignment: 'motorista',
    lastScore: 18,
    monthlyAnswers: {
      '2024-09': {
        1: { q1: 'SIM', q2: 'NAO', q3: 'NAO', q8: 'NAO' },
        2: { q1: 'NAO', q5: 'SIM', q6: 'SIM' },
        3: { q2: 'SIM', q3: 'SIM', q4: 'SIM', q10: 'NAO' },
        4: { q8: 'SIM', q9: 'SIM', q2: 'SIM' },
        5: { q1: 'NAO', q4: 'NAO' },
      },
    },
  },
  {
    id: '2',
    userId: 'u2',
    name: 'Patrícia Gomes',
    costCenterId: 'cc1',
    assignment: 'motorista',
    lastScore: 12,
    monthlyAnswers: {
      '2024-09': {
        1: { q1: 'NAO', q2: 'NAO', q3: 'NAO' },
        2: { q6: 'SIM', q5: 'NAO' },
        3: { q1: 'SIM', q8: 'NAO' },
        4: { q1: 'NAO', q2: 'NAO', q3: 'NAO', q4: 'NAO' },
      },
    },
  },
  {
    id: '3',
    userId: 'u3',
    name: 'Renato Costa',
    costCenterId: 'cc2',
    assignment: 'motorista',
    lastScore: 32,
    monthlyAnswers: {
      '2024-09': {
        1: { q2: 'SIM', q3: 'SIM', q8: 'SIM', q9: 'SIM' },
        2: { q1: 'SIM', q4: 'SIM', q6: 'SIM' },
      },
    },
  },
]
const userDirectory: UserDirectoryEntry[] = [
  {
    id: 'u1',
    name: 'Marcos Silva',
    email: 'marcos.silva@empresa.com',
    phone: '(11) 99999-1234',
    position: 'Motorista Sênior',
    costCenterId: 'cc1',
    assignments: ['motorista'],
    avatarUrl: 'https://ui-avatars.com/api/?name=Marcos+Silva&background=0EA5E9&color=fff',
  },
  {
    id: 'u2',
    name: 'Patrícia Gomes',
    email: 'patricia.gomes@empresa.com',
    phone: '(11) 98888-4321',
    position: 'Motorista',
    costCenterId: 'cc1',
    assignments: ['motorista'],
    
    avatarUrl: 'https://ui-avatars.com/api/?name=Patricia+Gomes&background=fb923c&color=fff',
  },
  {
    id: 'u3',
    name: 'Renato Costa',
    email: 'renato.costa@empresa.com',
    phone: '(11) 97777-9876',
    position: 'Motorista',
    costCenterId: 'cc2',
    assignments: ['motorista'],
    avatarUrl: 'https://ui-avatars.com/api/?name=Renato+Costa&background=22c55e&color=fff',
  },
  {
    id: 'u4',
    name: 'Bianca Pereira',
    email: 'bianca.pereira@empresa.com',
    phone: '(31) 91234-5678',
    position: 'Motorista Reserva',
    costCenterId: 'cc1',
    assignments: ['motorista'],
    avatarUrl: 'https://ui-avatars.com/api/?name=Bianca+Pereira&background=8b5cf6&color=fff',
  },
  {
    id: 'u5',
    name: 'Daniel Souza',
    email: 'daniel.souza@empresa.com',
    phone: '(21) 93456-7890',
    position: 'Motorista',
    costCenterId: 'cc2',
    assignments: ['motorista'],
    avatarUrl: 'https://ui-avatars.com/api/?name=Daniel+Souza&background=ef4444&color=fff',
  },
]

const days = Array.from({ length: 31 }, (_, index) => index + 1)
const availableMonths = [
  { value: '2024-09', label: 'Setembro/2024' },
  { value: '2024-08', label: 'Agosto/2024' },
  { value: '2024-07', label: 'Julho/2024' },
]

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
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0].value)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(31)
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [driverSearchTerm, setDriverSearchTerm] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState<'motorista' | 'outro'>('motorista')
  const [profileDriverId, setProfileDriverId] = useState<string | null>(null)
  const [driverAnswers, setDriverAnswers] = useState<
    Record<string, MonthlyAnswers>
  >(() => Object.fromEntries(initialDrivers.map((driver) => [driver.id, driver.monthlyAnswers])))

  const filteredDrivers = useMemo(
    () =>
      drivers.filter((driver) => {
        const directoryEntry = driver.userId
          ? userDirectory.find((user) => user.id === driver.userId)
          : null
        const hasMotoristaAssignment =
          driver.assignment === 'motorista' || directoryEntry?.assignments.includes('motorista')

        return driver.costCenterId === selectedCostCenter && hasMotoristaAssignment
      }),
    [drivers, selectedCostCenter]
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
  const selectedMonthLabel = availableMonths.find((month) => month.value === selectedMonth)?.label || selectedMonth
  const currentAnswers = currentDriver
    ? driverAnswers[currentDriver.id]?.[selectedMonth] || {}
    : {}
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
      const monthData = driverData[selectedMonth] || {}
      const dayData = monthData[day] || {}
      return {
        ...prev,
        [currentDriver.id]: {
          ...driverData,
          [selectedMonth]: {
            ...monthData,
            [day]: {
              ...dayData,
              [questionId]: value,
            },
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
          <h2>${currentDriver.name} • ${selectedMonthLabel}</h2>
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
    const monthSlug = selectedMonthLabel.replace(/[\s/]+/g, '-').toLowerCase()
    link.href = url
    link.download = `controle-fadiga-${currentDriver.name.replace(/\s+/g, '-').toLowerCase()}-${monthSlug}.html`
    link.click()
    URL.revokeObjectURL(url)
  }
  function getDriverStatusSnapshot(driver: Driver) {
    const monthAnswers = driverAnswers[driver.id]?.[selectedMonth] || {}
    const availableDays = Object.keys(monthAnswers)
      .map((day) => Number(day))
      .filter((day) => day >= startDay && day <= endDay)
      .sort((a, b) => b - a)
    const latestDay = availableDays[0] || endDay
    const score = getDayScore(monthAnswers[latestDay])
    return { latestDay, score, risk: getRisk(score) }
  }

  function handleAddDriver(user: UserDirectoryEntry) {
    const alreadyInList = drivers.some((driver) => driver.userId === user.id)
    if (alreadyInList) {
      setSelectedCostCenter(user.costCenterId)
      const existingDriver = drivers.find((driver) => driver.userId === user.id)
      if (existingDriver) {
        setSelectedDriver(existingDriver.id)
        setProfileDriverId(existingDriver.id)
      }
      setDriverSearchTerm('')
      return
    }

    const newDriver: Driver = {
      id: `driver-${user.id}`,
      userId: user.id,
      name: user.name,
      costCenterId: user.costCenterId,
      assignment: selectedAssignment,
      lastScore: 0,
      monthlyAnswers: {},
    }

    setDrivers((prev) => [...prev, newDriver])
    setDriverAnswers((prev) => ({
      ...prev,
      [newDriver.id]: newDriver.monthlyAnswers,
    }))
    setSelectedCostCenter(user.costCenterId)
    setSelectedDriver(newDriver.id)
    setProfileDriverId(newDriver.id)
    setDriverSearchTerm('')
  }

  const searchResults = useMemo(() => {
    if (!driverSearchTerm.trim()) return []
    const term = driverSearchTerm.toLowerCase()
      return userDirectory.filter((user) => {
        const matchesTerm =
          user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
        const matchesCostCenter = user.costCenterId === selectedCostCenter
        const alreadyAdded = drivers.some((driver) => driver.userId === user.id)
        const matchesAssignment = user.assignments.includes(selectedAssignment)
        return matchesTerm && matchesCostCenter && matchesAssignment && !alreadyAdded
      })
    }, [driverSearchTerm, drivers, selectedAssignment, selectedCostCenter])


  const costCenterInfo = costCenters.find((center) => center.id === selectedCostCenter)

  const currentDirectoryEntry = currentDriver?.userId
    ? userDirectory.find((user) => user.id === currentDriver.userId)
    : undefined

  const profileDriver = profileDriverId ? drivers.find((driver) => driver.id === profileDriverId) : null
  const profileDirectoryEntry = profileDriver?.userId
    ? userDirectory.find((user) => user.id === profileDriver.userId)
    : undefined
  const profileSnapshot = profileDriver ? getDriverStatusSnapshot(profileDriver) : null

  const summary = useMemo(() => {
    const totals = { aptos: 0, inaptos: 0 }
    filteredDrivers.forEach((driver) => {
      const status = getDriverStatusSnapshot(driver).risk.status
      if (status === 'APTO') totals.aptos += 1
      else totals.inaptos += 1
    })
    return totals
  }, [driverAnswers, filteredDrivers, endDay, selectedMonth, startDay])
  const statusPanelDrivers = useMemo(
    () =>
      filteredDrivers.map((driver) => ({
        driver,
        snapshot: getDriverStatusSnapshot(driver),
        directoryEntry: driver.userId
          ? userDirectory.find((user) => user.id === driver.userId)
          : undefined,
      })),
    [filteredDrivers, driverAnswers, endDay, selectedMonth, startDay]
  )


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
        {/* LADO ESQUERDO - FILTROS E RESUMO */}
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
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="assignment">
              Função do usuário
            </label>
            <select
              id="assignment"
              value={selectedAssignment}
              onChange={(event) => setSelectedAssignment(event.target.value as 'motorista' | 'outro')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              <option value="motorista">Motorista</option>
              <option value="outro">Outro</option>
            </select>
            <p className="text-2xs text-slate-500">
              Somente usuários com a função Motorista serão exibidos no painel de status.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-500">
              Buscar usuário cadastrado
            </label>
            <div className="relative">
              <input
                type="search"
                value={driverSearchTerm}
                onChange={(event) => setDriverSearchTerm(event.target.value)}
                placeholder="Digite nome ou e-mail e adicione como motorista"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
              />

              {driverSearchTerm && (
                <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                  {searchResults.length ? (
                    <ul className="divide-y divide-slate-100 text-sm text-slate-800">
                      {searchResults.map((user) => {
                        const userCostCenter = costCenters.find((center) => center.id === user.costCenterId)
                        return (
                          <li key={user.id}>
                            <button
                              type="button"
                              onClick={() => handleAddDriver(user)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                                  {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <UserRound className="h-full w-full p-2 text-slate-500" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold">{user.name}</p>
                                  <p className="text-xs text-slate-500">{user.email}</p>
                                  <p className="text-2xs text-slate-500">
                                    {userCostCenter ? `${userCostCenter.name} • Código ${userCostCenter.code}` : 'Centro não informado'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-2xs rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700">Adicionar</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-xs text-slate-500">Nenhum usuário encontrado nesta visão.</p>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Busque usuários já cadastrados e traga-os para a visão de motoristas do centro de custo selecionado.
            </p>
          </div>


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
                  onChange={(event) =>
                    setStartDay(Math.max(1, Math.min(days.length, Number(event.target.value))))
                  }
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
                  onChange={(event) =>
                    setEndDay(Math.max(startDay, Math.min(days.length, Number(event.target.value))))
                  }
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

        {/* LADO DIREITO */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-slate-500">Painel de status</p>
                <h2 className="text-xl font-semibold text-slate-900">Motoristas desta visão</h2>
                <p className="text-xs text-slate-600">
                  Veja o status mais recente e abra a ficha rápida com os dados do colaborador.
                </p>
              </div>
              <span className="text-2xs rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                Período {startDay}–{endDay}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {statusPanelDrivers.length ? (
                statusPanelDrivers.map(({ driver, snapshot, directoryEntry }) => (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => {
                      setSelectedDriver(driver.id)
                      setProfileDriverId(driver.id)
                    }}
                    className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-orange-500 hover:bg-orange-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100">
                          {directoryEntry?.avatarUrl ? (
                            <img
                              src={directoryEntry.avatarUrl}
                              alt={driver.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserRound className="h-full w-full p-2 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{driver.name}</p>
                          <p className="text-2xs text-slate-500">{directoryEntry?.position || 'Motorista'}</p>
                        </div>
                      </div>
                      <span className={`text-2xs rounded-full px-3 py-1 font-semibold ${snapshot.risk.color}`}>
                        {snapshot.risk.status}
                      </span>
                    </div>
                    <div className="text-2xs text-slate-600">
                      <p>Última referência: dia {snapshot.latestDay}</p>
                      <p>Pontuação: {snapshot.score} pts</p>
                      <p>Contato: {directoryEntry?.phone || 'Não informado'}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-600">Nenhum motorista disponível para o centro de custo.</p>
              )}
            </div>
          </div>

          {/* Lista de motoristas */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Motoristas</p>
                <h2 className="text-xl font-semibold text-slate-900">Nome e status</h2>
                <p className="text-xs text-slate-600">
                  Selecione um motorista e abra o formulário completo quando precisar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                disabled={!currentDriver}
                className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CalendarDays size={16} /> Abrir formulário
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredDrivers.map((driver) => {
                const statusSnapshot = getDriverStatusSnapshot(driver)
                const { latestDay, risk } = statusSnapshot
                const isSelected = driver.id === currentDriver?.id

                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => {
                      setSelectedDriver(driver.id)
                      setProfileDriverId(driver.id)
                    }}
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
                        risk.status === 'APTO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {risk.status}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info do centro de custo */}
          {costCenterInfo && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase text-slate-500">Centro vinculado</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-900">{costCenterInfo.name}</span>
                <span className="text-2xs rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">
                  {costCenterInfo.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Código interno: {costCenterInfo.code} • Externo {costCenterInfo.externalCode}
              </p>
              <p className="text-xs text-slate-500">Sigla: {costCenterInfo.sigla}</p>
            </div>
          )}

           </div>
      </div>
      {profileDriver && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
          role="dialog"
          aria-modal
          onClick={() => setProfileDriverId(null)}
        >
          <div className="flex min-h-full items-start justify-center overflow-y-auto p-4">
            <div
              className="w-full max-w-3xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-slate-500">Ficha do motorista</p>
                  <h2 className="text-xl font-semibold text-slate-900">{profileDriver.name}</h2>
                  <p className="text-sm text-slate-600">{profileDirectoryEntry?.position || 'Motorista'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xs rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                    Centro: {costCenters.find((center) => center.id === profileDriver.costCenterId)?.name || '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setProfileDriverId(null)}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
                <div className="flex items-center gap-3 md:col-span-2">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100">
                    {profileDirectoryEntry?.avatarUrl ? (
                      <img
                        src={profileDirectoryEntry.avatarUrl}
                        alt={profileDriver.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound className="h-full w-full p-3 text-slate-500" />
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{profileDriver.name}</p>
                    <p>{profileDirectoryEntry?.email || 'E-mail não informado'}</p>
                    <p>{profileDirectoryEntry?.phone || 'Contato não informado'}</p>
                  </div>
                </div>

                {profileSnapshot && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase text-slate-500">Status atual</p>
                    <div className="mt-2 space-y-1">
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${profileSnapshot.risk.color}`}
                      >
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {profileSnapshot.risk.status} • {profileSnapshot.risk.risk}
                      </div>
                      <p className="text-2xs text-slate-500">
                        Última referência: dia {profileSnapshot.latestDay} • Pontos {profileSnapshot.score}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase text-slate-500">Cargo e equipe</p>
                  <p className="font-semibold text-slate-900">{profileDirectoryEntry?.position || 'Motorista'}</p>
                  <p className="text-xs text-slate-500">
                    Centro de custo: {costCenters.find((center) => center.id === profileDriver.costCenterId)?.name || 'Não informado'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase text-slate-500">Contato rápido</p>
                  <p>E-mail: {profileDirectoryEntry?.email || '—'}</p>
                  <p>Telefone: {profileDirectoryEntry?.phone || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {isFormOpen && costCenterInfo && currentDriver && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
          role="dialog"
          aria-modal
        >
          <div
            className="flex min-h-full items-start justify-center overflow-y-auto p-4"
            onClick={() => setIsFormOpen(false)}
          >
            <div
              className="w-full max-w-6xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Formulário mensal</p>
                 <h2 className="text-xl font-semibold text-slate-900">Controle de fadiga ({selectedMonthLabel})</h2>
                  <p className="text-sm text-slate-600">{currentDriver.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                   <label className="text-xs font-semibold text-slate-700">
                    Mês
                    <select
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                      className="mt-1 w-40 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
                    >
                      {availableMonths.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadMonthlyReport}
                   className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
                  >
                    <FileDown size={16} /> Baixar documento filtrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Situação do motorista</p>
                    <p className="text-sm font-semibold text-slate-900">{currentDriver.name}</p>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${riskInfo.color}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" /> {riskInfo.status} • {riskInfo.risk}
                    </div>
                    <p className="text-xs text-slate-500">
                      Pontuação do dia {visibleDays[visibleDays.length - 1]}: {dayScore} pontos.
                    </p>
                  </div>
                   <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Resumo do mês</p>
                    <p className="text-sm text-slate-700">
                      Apto abaixo de 30 pontos. Inapto a partir de 30 pontos (risco grave). Registre S/N em cada dia.
                    </p>
                    <p className="text-xs text-slate-500">Pontuação do dia soma apenas respostas &quot;Sim&quot;.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Período ativo</p>
                    <div className="text-sm text-slate-700">Dias {startDay} a {endDay} visíveis.</div>
                    <div className="text-xs text-slate-500">Ajuste o período na tela principal para mudar a visão e os cálculos.</div>
                  </div>
                </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-start gap-2 text-slate-700">
                    <SlidersHorizontal size={16} className="mt-1 text-orange-500" />
                    <div className="flex-1 space-y-1 text-xs">
                      <p className="text-sm font-semibold">Visão filtrada pelo período escolhido</p>
                      <p className="text-slate-600">
                        O formulário abaixo já respeita o intervalo de dias definido na visão principal.
                      </p>
                    </div>
                  </div>
                </div>

             <div id="formulario-diario" className="overflow-x-auto rounded-lg border border-slate-200">
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

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
                  <AlertTriangle size={18} className="mt-0.5" />
                  <div>
                    <p className="font-semibold">Critérios para permissão de dirigir</p>
                    <p>
                      Apto até 29 pontos (risco leve/tolerável). Inapto a partir de 30 pontos (risco grave). Use o painel
                      para registrar o questionário diário e manter histórico de 31 dias.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
