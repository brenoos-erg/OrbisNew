'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SigningReturnPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assignmentId = searchParams.get('assignmentId')
  const [message, setMessage] = useState('Sincronizando assinatura com o DocuSign...')

  useEffect(() => {
    if (!assignmentId) {
      router.replace('/dashboard/meus-documentos')
      return
    }

    let cancelled = false

    async function syncStatus() {
      for (let attempt = 0; attempt < 8; attempt++) {
        const res = await fetch(`/api/meus-documentos/${assignmentId}/status`, { cache: 'no-store' })
        if (res.ok) {
          const payload = await res.json().catch(() => ({}))
          if (payload?.status === 'ASSINADO') {
            router.replace('/dashboard/meus-documentos?signed=1')
            return
          }
        }

        if (cancelled) {
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 1500))
      }

      if (!cancelled) {
        setMessage('Retorno recebido. Se o status ainda não mudou, aguarde alguns segundos e atualize a lista.')
      }
    }

    syncStatus()

    return () => {
      cancelled = true
    }
  }, [assignmentId, router])

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h1 className="text-xl font-semibold text-gray-900">Finalizando assinatura</h1>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      {assignmentId ? <p className="mt-2 text-xs text-gray-500">Atribuição: {assignmentId}</p> : null}
    </div>
  )
}