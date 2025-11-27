'use client'

import { useEffect, useState } from 'react'

type Solicitacao = {
  id: string
  titulo: string
  status: string
  createdAt: string
  tipo?: {
    nome: string
  }
}

export default function ListaSolicitacoesPage() {
  const [data, setData] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    async function load() {
      try {
        const res = await fetch('/api/solicitacoes', { cache: 'no-store' })
        if (!res.ok) {
          console.error('Erro ao buscar /api/solicitacoes')
          setData([])
          return
        }

        const json = await res.json()

        // 🔴 Aqui tratamos os possíveis formatos que a API pode retornar
        const list: unknown =
          Array.isArray(json)
            ? json
            : (json.solicitacoes ?? json.items ?? json.data ?? [])

        if (Array.isArray(list)) {
          setData(list as Solicitacao[])
        } else {
          console.error('Resposta de /api/solicitacoes não é uma lista', json)
          setData([])
        }
      } catch (err) {
        console.error('Erro ao carregar solicitações', err)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    load()
    interval = setInterval(load, 5000)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Solicitações</h1>

      <a
        href="/solicitacoes/nova"
        className="inline-block rounded bg-black px-3 py-2 text-white"
      >
        Nova
      </a>

      {loading && <p className="text-gray-600">Carregando...</p>}

      {!loading && (
        <div className="grid gap-3">
          {data.map((s) => (
            <a
              key={s.id}
              href={`/solicitacoes/${s.id}`}
              className="block rounded border bg-white p-3"
            >
              <div className="font-medium">{s.titulo}</div>
              <div className="text-sm text-gray-600">
                {s.tipo?.nome} • {s.status} •{' '}
                {new Date(s.createdAt).toLocaleString('pt-BR')}
              </div>
            </a>
          ))}

          {!data.length && (
            <p className="text-gray-600">Nenhuma solicitação ainda.</p>
          )}
        </div>
      )}
    </div>
  )
}
