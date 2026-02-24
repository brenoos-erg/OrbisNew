'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import WorkflowDiagram, { WorkflowDiagramData } from '@/components/solicitacoes/workflows/WorkflowDiagram'

type RefItem = { id: string; nome?: string; name?: string }

type Workflow = WorkflowDiagramData & {
  tipoId: string
  departmentId?: string | null
  active: boolean
}

function pickWorkflow(rows: Workflow[], tipoId: string, departmentId: string) {
  const candidates = rows.filter((row) => row.tipoId === tipoId && row.active)
  if (!departmentId) {
    return candidates.find((row) => !row.departmentId) ?? candidates[0] ?? null
  }

  return candidates.find((row) => row.departmentId === departmentId)
    ?? candidates.find((row) => !row.departmentId)
    ?? candidates[0]
    ?? null
}

export default function VisualizarWorkflowPage() {
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<Workflow[]>([])
  const [tipos, setTipos] = useState<RefItem[]>([])
  const [departments, setDepartments] = useState<RefItem[]>([])
  const [tipoId, setTipoId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTipoId(searchParams.get('tipoId') ?? '')
    setDepartmentId(searchParams.get('departmentId') ?? '')
  }, [searchParams])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [wfRes, tiposRes, depRes] = await Promise.all([
        fetch('/api/solicitation-workflows', { cache: 'no-store' }),
        fetch('/api/tipos-solicitacao', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
      ])

      setRows(await wfRes.json())
      setTipos(await tiposRes.json())
      setDepartments(await depRes.json())
      setLoading(false)
    }

    load()
  }, [])

  const selected = useMemo(() => pickWorkflow(rows, tipoId, departmentId), [rows, tipoId, departmentId])
  const sortedSteps = useMemo(() => (selected ? [...selected.steps].sort((a, b) => a.order - b.order) : []), [selected])

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Visualizar Fluxo de Solicitação</h1>
          <p className="text-sm text-slate-600">Selecione tipo e departamento para ver o workflow configurado.</p>
        </div>
        <Link className="rounded border px-3 py-2 text-sm" href="/dashboard/solicitacoes/fluxos">Voltar ao editor</Link>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <select className="rounded border px-3 py-2" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
          <option value="">Tipo de solicitação</option>
          {tipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
        </select>
        <select className="rounded border px-3 py-2" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Todos departamentos (usar fallback)</option>
          {departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">Carregando workflows...</div>
      ) : !tipoId ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">Selecione um Tipo de Solicitação para visualizar o fluxo.</div>
      ) : !selected ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
          Nenhum workflow encontrado para esse filtro. Crie um workflow no editor.
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <strong>{selected.name}</strong> • Tipo: {selected.tipo?.nome ?? '-'} • Departamento: {selected.department?.name ?? 'Fallback geral'}
          </div>
          <WorkflowDiagram workflow={selected} />
          <div className="rounded-xl border p-3">
            <h2 className="mb-2 text-sm font-semibold">Linha do tempo do fluxo</h2>
            <ol className="space-y-2">
              {sortedSteps.map((step) => (
                <li key={step.stepKey} className="rounded border p-2 text-sm">
                  <div className="font-medium">{step.order}. {step.label}</div>
                  <div className="text-xs text-slate-600">{step.stepKey} • {step.kind}</div>
                  {step.approverUser?.fullName && <div className="text-xs">Aprovador: {step.approverUser.fullName}</div>}
                  {Array.isArray((step as any).notificationEmails) && (step as any).notificationEmails.length > 0 && (
                    <div className="text-xs">E-mails notificados: {(step as any).notificationEmails.join(', ')}</div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}