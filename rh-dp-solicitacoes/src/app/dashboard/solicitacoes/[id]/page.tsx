'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Row,
  SolicitationDetail,
  SolicitationDetailModal,
} from '@/components/solicitacoes/SolicitationDetailModal'

const REDIRECT_PATH = '/dashboard/solicitacoes/recebidas'

function toRow(detail: SolicitationDetail): Row {
  return {
    id: detail.id,
    titulo: detail.titulo,
    status: detail.status,
    protocolo: detail.protocolo,
    createdAt: detail.dataAbertura,
    tipo: detail.tipo
      ? {
          codigo: undefined,
          nome: detail.tipo.nome,
        }
      : null,
    setorDestino: detail.department?.name ?? null,
  }
}

export default function SolicitationByIdPage() {
  const params = useParams<{ id: string | string[] }>()
  const router = useRouter()

  const solicitationId = useMemo(() => {
    const rawId = params?.id
    if (Array.isArray(rawId)) return rawId[0]
    return rawId
  }, [params])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [solicitation, setSolicitation] = useState<SolicitationDetail | null>(
    null,
  )

  useEffect(() => {
    if (!solicitationId) {
      router.replace(REDIRECT_PATH)
      return
    }

    const controller = new AbortController()

    async function fetchSolicitation() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/solicitacoes/${solicitationId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 404) {
          router.replace(REDIRECT_PATH)
          return
        }

        if (!response.ok) {
          throw new Error('Não foi possível carregar os detalhes da solicitação.')
        }

        const data = (await response.json()) as SolicitationDetail
        setSolicitation(data)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Erro ao carregar solicitação por ID', err)
        setError('Erro ao carregar a solicitação.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchSolicitation()

    return () => controller.abort()
  }, [router, solicitationId])

  const row = useMemo<Row | null>(() => {
    if (solicitation) return toRow(solicitation)
    if (!solicitationId) return null

    return {
      id: solicitationId,
      titulo: 'Solicitação',
      status: 'ABERTA',
      protocolo: '-',
    }
  }, [solicitation, solicitationId])

  return (
    <SolicitationDetailModal
      isOpen
      onClose={() => router.push(REDIRECT_PATH)}
      row={row}
      detail={solicitation}
      loading={loading}
      error={error}
    />
  )
}