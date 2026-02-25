// src/app/dashboard/solicitacoes/aprovacao/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import {
  SolicitationDetailModal,
  type Row,
  type SolicitationDetail,
} from '@/components/solicitacoes/SolicitationDetailModal'

type ApiResponse = {
  rows: Row[]
  total: number
}

export default function ApprovalsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allowedDepartmentIds, setAllowedDepartmentIds] = useState<string[]>([])

  // estado do modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [detail, setDetail] = useState<SolicitationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // ===== CARREGAR LISTA DE APROVAÇÕES =====
  async function loadApprovals() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(
        '/api/solicitacoes?scope=to-approve&page=1&pageSize=50',
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao carregar aprovações.')
      }

      const data = (await res.json()) as ApiResponse
      setRows(data.rows ?? [])
    } catch (err: any) {
      console.error('Erro ao carregar aprovações', err)
      setError(err?.message ?? 'Erro ao carregar aprovações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApprovals()
  }, [])


  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        const ids = [json.departmentId, ...(Array.isArray(json.departments) ? json.departments.map((d: any) => d.id) : [])]
          .filter(Boolean) as string[]
        setAllowedDepartmentIds(Array.from(new Set(ids)))
      } catch {
        setAllowedDepartmentIds([])
      }
    })()
  }, [])

  // ===== ABRIR MODAL / CARREGAR DETALHE =====
  async function handleOpenPreview(row: Row) {
    setSelectedRow(row)
    setIsModalOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)

    try {
      const res = await fetch(`/api/solicitacoes/${row.id}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao carregar detalhes.')
      }

      const data = (await res.json()) as SolicitationDetail
      setDetail(data)
    } catch (err: any) {
      console.error('Erro ao carregar detalhe da solicitação', err)
      setDetailError(err?.message ?? 'Erro ao carregar detalhes.')
    } finally {
      setDetailLoading(false)
    }
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    setSelectedRow(null)
    setDetail(null)
    setDetailError(null)
  }

  // ===== AÇÕES DE APROVAR / REPROVAR (botões da lista) =====
  async function handleApprove(e: React.MouseEvent, row: Row) {
    e.stopPropagation() // não abrir o modal ao clicar no botão
    


    try {
      const res = await fetch(`/api/solicitacoes/${row.id}/aprovar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },

      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao aprovar a solicitação.')
      }
      await loadApprovals()
    } catch (err: any) {
      console.error(err)
      alert(err?.message ?? 'Erro ao aprovar a solicitação.')
    }
  }

  async function handleReject(e: React.MouseEvent, row: Row) {
    e.stopPropagation()
    const rawComment = window.prompt(
      'Informe o motivo da reprovação (obrigatório):',
    )

    if (!rawComment) {
      alert('É necessário informar um comentário para reprovar.')
      return
    }

    const comment = rawComment.trim()

    if (comment.length === 0) {
      alert('É necessário informar um comentário para reprovar.')
      return
    }

    try {
      const res = await fetch(`/api/solicitacoes/${row.id}/reprovar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? 'Erro ao reprovar a solicitação.')
      }
      await loadApprovals()
    } catch (err: any) {
      console.error(err)
      alert(err?.message ?? 'Erro ao reprovar a solicitação.')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            Painel de Aprovação
          </h1>
          <p className="text-xs text-slate-500">
            Solicitações pendentes de aprovação para você.
          </p>
        </div>

        <button
          onClick={loadApprovals}
          className="rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Atualizar
        </button>
      </div>

      {error && (
        <p className="mb-2 text-xs text-red-600">{error}</p>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left">Protocolo</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Título</th>
              <th className="px-3 py-2 text-left">Solicitante</th>
              <th className="px-3 py-2 text-left">Departamento</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-xs text-slate-500"
                >
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-xs text-slate-500"
                >
                  Nenhuma solicitação pendente de aprovação.
                </td>
              </tr>
            ) : (
                rows.map((row) => {
                const canApproveRow = !!row.departmentId && allowedDepartmentIds.includes(row.departmentId)
                return (
                <tr
                   key={row.id}
                  onClick={() => handleOpenPreview(row)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 text-xs">
                    {row.protocolo ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.tipo ? `${row.tipo.codigo} - ${row.tipo.nome}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.titulo}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.autor?.fullName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.setorDestino ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <button
                      onClick={(e) => handleApprove(e, row)}
                       disabled={!canApproveRow}
                      className="mr-2 rounded bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={(e) => handleReject(e, row)}
                      disabled={!canApproveRow}
                      className="rounded bg-red-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reprovar
                    </button>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE DETALHES (modo aprovação) */}
      <SolicitationDetailModal
        mode="approval"
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        row={selectedRow}
        detail={detail}
        loading={detailLoading}
        error={detailError}
      />
    </div>
  )
}
