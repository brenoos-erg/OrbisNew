'use client'

import { useRouter } from 'next/navigation'
import { use, useEffect, useState } from 'react'

import { CargoFormModal, type PositionRow } from '@/app/dashboard/configuracoes/cargos/CargoFormModal'

export default function EditarCargoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id: cargoId } = use(params)
  const [cargo, setCargo] = useState<PositionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const backToList = () => router.push('/dashboard/configuracoes/cargos')

  useEffect(() => {
    let active = true

    async function loadCargo() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/positions/${cargoId}`)

        if (!response.ok) {
          setError(response.status === 404 ? 'Cargo não encontrado' : 'Erro ao carregar cargo')
          return
        }

        const data = await response.json()
        if (active) setCargo(data)
      } catch (err) {
        console.error(err)
        if (active) setError('Erro ao carregar cargo')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCargo()

    return () => {
      active = false
    }
  }, [cargoId])

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-gray-500">Carregando...</p>
      </main>
    )
  }

  if (error || !cargo) {
    return (
      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <p className="text-sm text-red-600">{error ?? 'Cargo não encontrado'}</p>
        <button type="button" onClick={backToList} className="px-3 py-2 border rounded text-sm">
          Voltar
        </button>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Editar cargo</h1>
          <p className="text-xs text-gray-500">
            Atualize o cadastro oficial do cargo, substitua o documento vigente quando necessário e mantenha o histórico para a RQ_063.
          </p>
        </div>
      </header>

      <CargoFormModal row={cargo} onClose={backToList} onSaved={backToList} />
    </main>
  )
}
