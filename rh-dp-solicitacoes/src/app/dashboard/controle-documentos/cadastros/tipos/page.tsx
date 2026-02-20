'use client'

import { useEffect, useState } from 'react'

export default function TiposDocumentosPage() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/document-types', { cache: 'no-store' }).then((r) => r.json()).then(setRows)
  }, [])

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">Tipos de Documento</h1>
      <table className="w-full text-sm">
        <thead><tr><th>Código</th><th>Descrição</th><th>Cópia Controlada?</th><th>Associa Área do CC?</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t" key={row.id}><td>{row.code}</td><td>{row.description}</td><td>{row.controlledCopy ? 'Sim' : 'Não'}</td><td>{row.linkCostCenterArea ? 'Sim' : 'Não'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}