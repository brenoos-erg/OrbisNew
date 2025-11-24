'use client'

import * as React from 'react'
import type { PositionRow } from './page'

const INPUT =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300'

export type Position = {
  id?: string
  name: string
  description?: string | null
  departmentId?: string | null

  sectorProject?: string | null
  workplace?: string | null
  workSchedule?: string | null
  mainActivities?: string | null
  complementaryActivities?: string | null
  schooling?: string | null
  course?: string | null
  schoolingCompleted?: string | null
  courseInProgress?: string | null
  periodModule?: string | null
  requiredKnowledge?: string | null
  behavioralCompetencies?: string | null
  enxoval?: string | null
  uniform?: string | null
  others?: string | null
  workPoint?: string | null
  site?: string | null
  experience?: string | null
}

/**
 * Modal de criação/edição do cargo
 */
export function CargoFormModal({
  row,
  onClose,
  onSaved,
}: {
  row?: PositionRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!row?.id
  const [name, setName] = React.useState(row?.name ?? '')
  const [description, setDescription] = React.useState(row?.description ?? '')
  const [sectorProject, setSectorProject] = React.useState(row?.sectorProject ?? '',)
  const [workplace, setWorkplace] = React.useState(row?.workplace ?? '')
  const [workSchedule, setWorkSchedule] = React.useState(row?.workSchedule ?? '',)
  const [experience, setExperience] = React.useState(row?.experience ?? '')
  const [mainActivities, setMainActivities] = React.useState(row?.mainActivities ?? '',)
  const [complementaryActivities, setComplementaryActivities] = React.useState(row?.complementaryActivities ?? '',)
  const [schooling, setSchooling] = React.useState(row?.schooling ?? '')
  const [course, setCourse] = React.useState(row?.course ?? '')
  const [schoolingCompleted, setSchoolingCompleted] = React.useState(row?.schoolingCompleted ?? '',)
  const [courseInProgress, setCourseInProgress] = React.useState(row?.courseInProgress ?? '',)
  const [periodModule, setPeriodModule] = React.useState(row?.periodModule ?? '',)
  const [requiredKnowledge, setRequiredKnowledge] = React.useState(row?.requiredKnowledge ?? '',)
  const [behavioralCompetencies, setBehavioralCompetencies] = React.useState(row?.behavioralCompetencies ?? '',)
  const [workPoint, setWorkPoint] = React.useState(row?.workPoint ?? '')
  const [site, setSite] = React.useState(row?.site ?? '')
  const [saving, setSaving] = React.useState(false)
  



  async function handleSave() {
    if (!name.trim()) {
      alert('Nome do cargo é obrigatório.')
      return
    }
    setSaving(true)
    try {
      const payload: Position = {
        name,
        description,
        sectorProject,
        workplace,
        workSchedule,
        mainActivities,
        complementaryActivities,
        schooling,
        course,
        schoolingCompleted,
        courseInProgress,
        periodModule,
        requiredKnowledge,
        behavioralCompetencies,
        experience,
        workPoint,
        site,
      }

      const url = row?.id ? `/api/positions/${row.id}` : '/api/positions'
      const method = row?.id ? 'PATCH' : 'POST'

      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err?.error || 'Falha ao salvar cargo.')
        return
      }

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isEdit ? 'Editar cargo' : 'Novo cargo'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Nome */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Nome do cargo *
            </label>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Descrição */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Descrição / resumo
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Linha 1 */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Setor / Projeto
            </label>
            <input
              className={INPUT}
              value={sectorProject || ''}
              onChange={(e) => setSectorProject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Local de trabalho
            </label>
            <input
              className={INPUT}
              value={workplace || ''}
              onChange={(e) => setWorkplace(e.target.value)}
            />
          </div>

          {/* Linha 2 */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Horário de trabalho
            </label>
            <input
              className={INPUT}
              value={workSchedule || ''}
              onChange={(e) => setWorkSchedule(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Experiência mínima
            </label>
            <input
              className={INPUT}
              value={experience || ''}
              onChange={(e) => setExperience(e.target.value)}
            />
          </div>

          {/* Principais atividades */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Principais atividades
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={mainActivities || ''}
              onChange={(e) => setMainActivities(e.target.value)}
            />
          </div>

          {/* Atividades complementares */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Atividades complementares
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={complementaryActivities || ''}
              onChange={(e) => setComplementaryActivities(e.target.value)}
            />
          </div>

          {/* Escolaridade / Curso */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Escolaridade
            </label>
            <input
              className={INPUT}
              value={schooling || ''}
              onChange={(e) => setSchooling(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Curso
            </label>
            <input
              className={INPUT}
              value={course || ''}
              onChange={(e) => setCourse(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Escolaridade completa?
            </label>
            <input
              className={INPUT}
              value={schoolingCompleted || ''}
              onChange={(e) => setSchoolingCompleted(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Curso em andamento?
            </label>
            <input
              className={INPUT}
              value={courseInProgress || ''}
              onChange={(e) => setCourseInProgress(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Período / Módulo - mínimo ou máximo
            </label>
            <input
              className={INPUT}
              value={periodModule || ''}
              onChange={(e) => setPeriodModule(e.target.value)}
            />
          </div>

          {/* Requisitos e competências */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Requisitos e conhecimentos necessários
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={requiredKnowledge || ''}
              onChange={(e) => setRequiredKnowledge(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase">
              Competências comportamentais exigidas
            </label>
            <textarea
              className={INPUT}
              rows={3}
              value={behavioralCompetencies || ''}
              onChange={(e) => setBehavioralCompetencies(e.target.value)}
            />
          </div>

          {/* Local / ponto de trabalho */}
          <div>
            <label className="block text-xs font-semibold uppercase">
              Ponto de trabalho
            </label>
            <input
              className={INPUT}
              value={workPoint || ''}
              onChange={(e) => setWorkPoint(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase">
              Local (Matriz / Filial / etc.)
            </label>
            <input
              className={INPUT}
              value={site || ''}
              onChange={(e) => setSite(e.target.value)}
            />
          </div>

          {/* Botões */}
          <div className="sm:col-span-2 mt-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-950 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Botão + modal (usado na listagem)
 */
export function CargoFormTrigger({ row }: { row?: PositionRow }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          row
            ? 'text-xs rounded-md border px-2 py-1 hover:bg-slate-50'
            : 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-950'
        }
      >
        {row ? 'Editar' : 'Novo cargo'}
      </button>
      {open && (
        <CargoFormModal
          row={row ?? null}
          onClose={() => setOpen(false)}
          onSaved={() => window.location.reload()}
        />
      )}
    </>
  )
}

/**
 * Botão de excluir (client)
 */
export function CargoDeleteButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este cargo?')) return
    await fetch(`/api/positions/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
    >
      Excluir
    </button>
  )
}
