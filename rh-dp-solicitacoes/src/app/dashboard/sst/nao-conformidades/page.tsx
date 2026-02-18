import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import NaoConformidadesClient from './NaoConformidadesClient'

export default function NaoConformidadesPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="rounded-full bg-orange-50 p-3 text-orange-700">
          <ShieldAlert size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase text-slate-500">Não Conformidades</p>
          <h1 className="text-3xl font-bold text-slate-900">Não Conformidades</h1>
          <p className="max-w-3xl text-slate-600">Gerencie o ciclo completo de identificação, tratativa e verificação de eficácia.</p>
        </div>
        <div className="ml-auto">
          <Link href="/dashboard/sst/nao-conformidades/nova" className="inline-flex items-center rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600">Nova não conformidade</Link>
        </div>
      </header>
      <NaoConformidadesClient />
    </div>
  )
}