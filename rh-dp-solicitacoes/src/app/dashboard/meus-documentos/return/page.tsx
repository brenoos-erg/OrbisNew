'use client'

import { useSearchParams } from 'next/navigation'

export default function SigningReturnPage() {
  const searchParams = useSearchParams()
  const assignmentId = searchParams.get('assignmentId')

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h1 className="text-xl font-semibold text-gray-900">Assinatura finalizada</h1>
      <p className="mt-2 text-sm text-gray-600">
        Recebemos o retorno da DocuSign. Aguarde alguns segundos e atualize a tela de documentos
        para ver a confirmação do status.
      </p>
      {assignmentId ? (
        <p className="mt-2 text-xs text-gray-500">Atribuição: {assignmentId}</p>
      ) : null}
      <a
        href="/dashboard/meus-documentos"
        className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Voltar para meus documentos
      </a>
    </div>
  )
}