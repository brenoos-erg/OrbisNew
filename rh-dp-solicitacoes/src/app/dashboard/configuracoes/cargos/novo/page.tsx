'use client'

import { useRouter } from 'next/navigation'

import { CargoFormModal } from '@/app/dashboard/configuracoes/cargos/CargoFormModal'

export default function NovoCargoPage() {
  const router = useRouter()
  const backToList = () => router.push('/dashboard/configuracoes/cargos')

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Novo cargo</h1>
          <p className="text-xs text-gray-500">
            Importe o documento oficial DD.RH do cargo, revise os campos extraídos e salve o cadastro usado na RQ_063.
          </p>
        </div>
      </header>

      <CargoFormModal row={null} onClose={backToList} onSaved={backToList} />
    </main>
  )
}
