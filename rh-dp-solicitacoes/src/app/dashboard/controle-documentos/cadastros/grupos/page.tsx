'use client'

import { useEffect, useState } from 'react'

export default function GruposAprovadoresPage() {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/approver-groups', { cache: 'no-store' }).then((r) => r.json()).then(setRows)
  }, [])

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <h1 className="text-xl font-semibold">Grupos Aprovadores</h1>
      <table className="w-full text-sm">
        <thead><tr><th>Nome</th><th>Departamento</th><th>Membros</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t" key={row.id}><td>{row.name}</td><td>{row.department?.name ?? '-'}</td><td>{row.members?.length ?? 0}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}