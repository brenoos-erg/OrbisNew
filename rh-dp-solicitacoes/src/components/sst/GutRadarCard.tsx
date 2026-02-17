'use client'

import { gutClassificacao } from '@/lib/sst/gut'

type Props = {
  gravidade: number
  urgencia: number
  tendencia: number
}

function pointForAxis(index: number, value: number, cx: number, cy: number, radius: number, totalAxes: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / totalAxes
  const normalized = Math.min(5, Math.max(1, value)) / 5
  return {
    x: cx + Math.cos(angle) * radius * normalized,
    y: cy + Math.sin(angle) * radius * normalized,
  }
}

export default function GutRadarCard({ gravidade, urgencia, tendencia }: Props) {
  const values = [gravidade, urgencia, tendencia]
  const labels = ['Gravidade', 'Urgência', 'Tendência']
  const score = gravidade * urgencia * tendencia
  const nivel = gutClassificacao(score)
  const cx = 110
  const cy = 110
  const radius = 82

  const polygonPoints = values
    .map((value, index) => {
      const point = pointForAxis(index, value, cx, cy, radius, values.length)
      return `${point.x},${point.y}`
    })
    .join(' ')

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <h3 className="text-base font-semibold text-slate-900">Análise GUT</h3>
      <svg viewBox="0 0 220 220" className="mx-auto h-56 w-56">
        {[1, 2, 3, 4, 5].map((ring) => {
          const p = [0, 1, 2]
            .map((axis) => pointForAxis(axis, ring, cx, cy, radius, 3))
            .map((pt) => `${pt.x},${pt.y}`)
            .join(' ')
          return <polygon key={ring} points={p} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        })}
        {[0, 1, 2].map((axis) => {
          const pt = pointForAxis(axis, 5, cx, cy, radius, 3)
          return <line key={axis} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="#cbd5e1" strokeWidth="1" />
        })}
        <polygon points={polygonPoints} fill="rgba(249,115,22,0.25)" stroke="#f97316" strokeWidth="2" />
        {[0, 1, 2].map((axis) => {
          const outer = pointForAxis(axis, 5.5, cx, cy, radius, 3)
          return (
            <text key={axis} x={outer.x} y={outer.y} textAnchor="middle" className="fill-slate-600 text-[10px] font-medium">
              {labels[axis]}
            </text>
          )
        })}
      </svg>
      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">GUT - {nivel}</p>
        <p>{gravidade} × {urgencia} × {tendencia} = <span className="font-semibold">{score}</span></p>
      </div>
    </section>
  )
}