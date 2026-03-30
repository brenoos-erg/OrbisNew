'use client'

import { useEffect, useState } from 'react'

type Item = {
  id: string
  action: 'VIEW' | 'DOWNLOAD' | 'PRINT'
  createdAt: string
  ip: string | null
  userAgent: string | null
  user: { id: string; fullName: string | null; email: string }
  document: { id: string; code: string; title: string }
  version: { id: string; revisionNumber: number }
}

export default function DocumentHistoryClient() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    fetch('/api/documents/history', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Histórico documental</h1>
      <p className="mt-1 text-sm text-slate-600">Auditoria de visualização, download e impressão por documento/versão.</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Data/Hora</th>
              <th className="px-3 py-2">Ação</th>
              <th className="px-3 py-2">Documento</th>
              <th className="px-3 py-2">Revisão</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2">{item.action}</td>
                <td className="px-3 py-2">{item.document.code} — {item.document.title}</td>
                <td className="px-3 py-2">REV{String(item.version.revisionNumber).padStart(2, '0')}</td>
                <td className="px-3 py-2">{item.user.fullName || item.user.email}</td>
                <td className="px-3 py-2">{item.ip || '-'}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>Nenhum evento auditado até o momento.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}