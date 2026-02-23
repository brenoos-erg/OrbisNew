'use client'

import { useMemo, useState } from 'react'

type StepKind = 'QUEUE' | 'APPROVAL' | 'ACTION' | 'END'

type WorkflowStep = {
  id?: string
  order: number
  stepKey: string
  label: string
  kind: StepKind
  defaultDepartment?: { id: string; name: string } | null
  defaultCostCenter?: { id: string; description?: string; code?: string } | null
  approverGroup?: { id: string; name?: string } | null
  approverUser?: { id: string; fullName?: string; name?: string } | null
  requiresApproval: boolean
  canAssume: boolean
  canFinalize: boolean
}

type WorkflowTransition = {
  id?: string
  fromStepKey?: string
  toStepKey?: string
  fromStepId?: string
  toStepId?: string
  conditionJson?: Record<string, unknown> | null
}

export type WorkflowDiagramData = {
  id: string
  name: string
  tipo?: { id?: string; nome?: string } | null
  department?: { id?: string; name?: string } | null
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
}

type PositionedStep = WorkflowStep & { x: number; y: number }
type DiagramEdge = { id: string; source: string; target: string; label?: string }

const NODE_WIDTH = 288
const NODE_HEIGHT = 174
const X_GAP = 320
const Y_GAP = 160

const kindBadge: Record<StepKind, string> = {
  QUEUE: 'bg-slate-100 text-slate-700',
  APPROVAL: 'bg-amber-100 text-amber-700',
  ACTION: 'bg-blue-100 text-blue-700',
  END: 'bg-emerald-100 text-emerald-700',
}

function conditionLabel(condition: Record<string, unknown> | null | undefined) {
  if (!condition) return ''
  const field = typeof condition.field === 'string' ? condition.field : ''
  const op = typeof condition.op === 'string' ? condition.op : ''
  const value = typeof condition.value === 'string' ? condition.value : ''
  if (!field && !op && !value) return ''
  return [field, op, value].filter(Boolean).join(' ')
}

function buildNodes(workflow: WorkflowDiagramData) {
  const sorted = [...workflow.steps].sort((a, b) => a.order - b.order)
  const yMap = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  workflow.transitions.forEach((transition) => {
    const from = transition.fromStepKey
    const to = transition.toStepKey
    if (!from || !to) return
    const list = outgoing.get(from) ?? []
    list.push(to)
    outgoing.set(from, list)
  })

  sorted.forEach((step) => {
    if (!yMap.has(step.stepKey)) {
      yMap.set(step.stepKey, 0)
    }

    const targets = outgoing.get(step.stepKey) ?? []
    targets.forEach((targetKey, index) => {
      if (yMap.has(targetKey)) return
      const branchOffset = targets.length > 1 ? (index - (targets.length - 1) / 2) * Y_GAP : 0
      yMap.set(targetKey, branchOffset)
    })
  })

  return sorted.map((step) => ({
    ...step,
    x: (step.order - 1) * X_GAP,
    y: yMap.get(step.stepKey) ?? 0,
  }))
}

function buildEdges(workflow: WorkflowDiagramData, stepById: Map<string, string>): DiagramEdge[] {
  const edges = workflow.transitions
    .map((transition, idx) => {
      const source = transition.fromStepKey || stepById.get(transition.fromStepId ?? '')
      const target = transition.toStepKey || stepById.get(transition.toStepId ?? '')
      if (!source || !target) return null

      return {
        id: transition.id ?? `edge-${idx}`,
        source,
        target,
        label: conditionLabel(transition.conditionJson),
      }
    })
    .filter(Boolean) as DiagramEdge[]

  if (edges.length > 0) return edges

  const sorted = [...workflow.steps].sort((a, b) => a.order - b.order)
  return sorted.slice(0, -1).map((step, index) => ({
    id: `fallback-${step.stepKey}-${sorted[index + 1].stepKey}`,
    source: step.stepKey,
    target: sorted[index + 1].stepKey,
  }))
}

function WorkflowNode({ data }: { data: WorkflowStep }) {
  const flags = [
    data.requiresApproval ? 'Requires approval' : null,
    data.canAssume ? 'Pode assumir' : null,
    data.canFinalize ? 'Pode finalizar' : null,
  ].filter(Boolean)

  return (
    <div className="h-full w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <strong className="text-sm text-slate-900">{data.label}</strong>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${kindBadge[data.kind]}`}>{data.kind}</span>
      </div>
      <p className="text-xs text-slate-500">{data.stepKey}</p>

      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {flags.map((flag) => (
            <span key={flag} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{flag}</span>
          ))}
        </div>
      )}

      <div className="mt-2 space-y-1 text-[11px] text-slate-600">
        {data.defaultDepartment?.name && <p>Dept destino: {data.defaultDepartment.name}</p>}
        {(data.defaultCostCenter?.description || data.defaultCostCenter?.code) && (
          <p>CC destino: {data.defaultCostCenter.description ?? data.defaultCostCenter.code}</p>
        )}
        {(data.approverGroup?.name || data.approverUser?.fullName || data.approverUser?.name) && (
          <p>
            Aprovador: {[data.approverGroup?.name, data.approverUser?.fullName ?? data.approverUser?.name].filter(Boolean).join(' / ')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function WorkflowDiagram({ workflow }: { workflow: WorkflowDiagramData }) {
  const [zoom, setZoom] = useState(1)

  const { nodes, edges, bounds } = useMemo(() => {
    const stepById = new Map(workflow.steps.map((step) => [step.id ?? '', step.stepKey]))
    const positioned = buildNodes(workflow)
    const links = buildEdges(workflow, stepById)

    const xs = positioned.map((step) => step.x)
    const ys = positioned.map((step) => step.y)
    const minX = Math.min(...xs, 0)
    const maxX = Math.max(...xs, 0)
    const minY = Math.min(...ys, 0)
    const maxY = Math.max(...ys, 0)

    return {
      nodes: positioned,
      edges: links,
      bounds: {
        minX,
        maxX,
        minY,
        maxY,
      },
    }
  }, [workflow])

  const diagramWidth = bounds.maxX - bounds.minX + NODE_WIDTH + 180
  const diagramHeight = bounds.maxY - bounds.minY + NODE_HEIGHT + 220

  const mapByKey = new Map(nodes.map((step) => [step.stepKey, step]))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap gap-2">
          {(['QUEUE', 'APPROVAL', 'ACTION', 'END'] as StepKind[]).map((kind) => (
            <span key={kind} className={`rounded-full px-2 py-1 font-medium ${kindBadge[kind]}`}>{kind}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border px-2 py-1" onClick={() => setZoom(1)}>Fit view</button>
          <label className="text-slate-600">Zoom</label>
          <input
            type="range"
            min={0.6}
            max={1.5}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="h-[620px] w-full overflow-auto rounded-xl border border-slate-200 bg-slate-50">
        <div
          className="relative origin-top-left"
          style={{ width: diagramWidth, height: diagramHeight, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
        >
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${diagramWidth} ${diagramHeight}`}>
            <defs>
              <marker id="arrow" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto">
                <path d="M0,0 L12,4 L0,8 Z" fill="#64748b" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const source = mapByKey.get(edge.source)
              const target = mapByKey.get(edge.target)
              if (!source || !target) return null

              const x1 = source.x - bounds.minX + NODE_WIDTH
              const y1 = source.y - bounds.minY + NODE_HEIGHT / 2
              const x2 = target.x - bounds.minX
              const y2 = target.y - bounds.minY + NODE_HEIGHT / 2
              const midX = x1 + (x2 - x1) / 2

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="1.6"
                    markerEnd="url(#arrow)"
                  />
                  {edge.label && (
                    <text x={midX} y={(y1 + y2) / 2 - 6} textAnchor="middle" className="fill-slate-700 text-[11px]">
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {nodes.map((step) => (
            <div
              key={step.stepKey}
              className="absolute"
              style={{ left: step.x - bounds.minX + 40, top: step.y - bounds.minY + 40, width: NODE_WIDTH, height: NODE_HEIGHT }}
            >
              <WorkflowNode data={step} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
