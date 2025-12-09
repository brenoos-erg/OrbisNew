'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ClipboardList, UserCheck } from 'lucide-react'

type Driver = {
  id: string
  name: string
  lastScore: number
}

type Question = {
  id: string
  label: string
  weight: number
}

const drivers: Driver[] = [
  { id: '1', name: 'Marcos Silva', lastScore: 12 },
  { id: '2', name: 'Patrícia Gomes', lastScore: 18 },
  { id: '3', name: 'Renato Costa', lastScore: 28 },
]

const questions: Question[] = [
  { id: 'q1', label: 'Dormiu menos de 8 horas?', weight: 5 },
  { id: 'q2', label: 'Está com sonolência?', weight: 30 },
  { id: 'q3', label: 'Está se sentindo mal?', weight: 10 },
  { id: 'q4', label: 'Está com problema estomacal?', weight: 5 },
  { id: 'q5', label: 'Está com preocupações pessoais?', weight: 10 },
  { id: 'q6', label: 'Está se sentindo estressado?', weight: 10 },
  { id: 'q7', label: 'Vai dirigir sozinho/sem rádio?', weight: 5 },
  { id: 'q8', label: 'Ingeriu bebida alcoólica nas últimas 8h?', weight: 20 },
  { id: 'q9', label: 'Tomou medicamento nas últimas 8h?', weight: 10 },
  { id: 'q10', label: 'Dificuldade de adaptação ao veículo?', weight: 5 },
]

function getRisk(score: number) {
  if (score < 20) return { risk: 'Risco leve', status: 'APTO', color: 'text-green-700 bg-green-50' }
  if (score < 30) return { risk: 'Risco tolerável', status: 'APTO', color: 'text-amber-700 bg-amber-50' }
  return { risk: 'Risco grave', status: 'INAPTO', color: 'text-red-700 bg-red-50' }
}

export default function DriversPage() {
  const [selectedDriver, setSelectedDriver] = useState(drivers[0].id)
  const [answers, setAnswers] = useState<Record<string, 'SIM' | 'NAO'>>({})

  const totalScore = useMemo(
    () =>
      questions.reduce((total, question) => {
        const answeredYes = answers[question.id] === 'SIM'
        return total + (answeredYes ? question.weight : 0)
      }, 0),
    [answers]
  )

  const riskInfo = getRisk(totalScore)

  function handleAnswer(id: string, value: 'SIM' | 'NAO') {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase text-slate-500">Gestão de Frotas</p>
        <h1 className="text-3xl font-bold text-slate-900">Motoristas</h1>
        <p className="text-slate-600 max-w-3xl text-sm">
          Registre a fadiga do motorista com perguntas objetivas. Cada resposta "Sim" soma pontos e altera o risco de
          direção. Acima de 30 pontos o condutor fica inapto.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-orange-500" size={18} />
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Controle de fadiga</p>
              <h2 className="text-lg font-semibold text-slate-900">Perguntas rápidas</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {questions.map((question) => (
              <div key={question.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{question.label}</p>
                  <span className="text-xs font-semibold text-slate-400">{question.weight} pts</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAnswer(question.id, 'SIM')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      answers[question.id] === 'SIM'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnswer(question.id, 'NAO')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      answers[question.id] === 'NAO'
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Motorista</p>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            >
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
            <div className={`rounded-lg p-3 text-sm font-semibold ${riskInfo.color}`}>
              {riskInfo.risk} • {riskInfo.status}
            </div>
            <p className="text-xs text-slate-600">
              Abaixo de 20 pontos: risco leve (apto). De 20 a 29 pontos: risco tolerável (apto). A partir de 30 pontos: risco
              grave e motorista inapto.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="text-green-600" size={18} />
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Resultado</p>
                <h2 className="text-lg font-semibold text-slate-900">Pontuação de fadiga</h2>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalScore} pts</p>
            <div className={`rounded-lg p-3 text-sm font-semibold ${riskInfo.color}`}>{riskInfo.risk}</div>
            <p className="text-xs text-slate-600">
              Quanto mais respostas "Sim", maior a pontuação. Use esta tela antes do check-in para liberar ou bloquear
              o condutor.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
            <AlertTriangle size={18} className="mt-0.5" />
            <div>
              <p className="font-semibold">Critérios para permissão de dirigir</p>
              <p>Apto abaixo de 30 pontos. Inapto a partir de 30 pontos (risco grave).</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase text-slate-500">Últimos motoristas avaliados</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {drivers.map((driver) => {
            const risk = getRisk(driver.lastScore)
            return (
              <div key={driver.id} className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">{driver.name}</p>
                <p className="text-xs text-slate-500">Pontuação anterior</p>
                <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${risk.color}`}>
                  {driver.lastScore} pts • {risk.status}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}