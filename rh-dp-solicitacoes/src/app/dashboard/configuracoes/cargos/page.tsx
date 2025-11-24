import { prisma } from '@/lib/prisma'
import {
  CargoFormTrigger,
  CargoDeleteButton,
} from './CargoFormModal'

export type PositionRow = {
  id: string
  name: string
  description: string | null
  sectorProject: string | null
  workplace: string | null
  workSchedule: string | null
  mainActivities: string | null
  complementaryActivities: string | null
  schooling: string | null
  course: string | null
  schoolingCompleted: string | null
  courseInProgress: string | null
  periodModule: string | null
  requiredKnowledge: string | null
  behavioralCompetencies: string | null
  experience: string | null
  workPoint: string | null
  site: string | null
}

export default async function CargosPage() {
  const rows = (await prisma.position.findMany({
    orderBy: { name: 'asc' },
  })) as PositionRow[]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Cargos</h1>
        <CargoFormTrigger />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Descrição</th>
              <th className="px-4 py-2">Local de trabalho</th>
              <th className="px-4 py-2">Horário</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="last:border-b-0">
                <td className="px-4 py-2 font-medium text-slate-900">
                  {r.name}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {r.description || '—'}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {r.workplace || '—'}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {r.workSchedule || '—'}
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <CargoFormTrigger row={r} />
                  <CargoDeleteButton id={r.id} />
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  Nenhum cargo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
