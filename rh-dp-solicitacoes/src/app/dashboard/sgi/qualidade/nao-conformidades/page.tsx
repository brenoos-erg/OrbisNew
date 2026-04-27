import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import NaoConformidadesClient from '@/app/dashboard/sst/nao-conformidades/NaoConformidadesClient'

export default function NaoConformidadesPage() {
  return (
    <div className="app-page">
      <header className="app-page-header">
        <div className="rounded-full bg-orange-100 p-3 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
          <ShieldAlert size={20} />
        </div>
        <div className="space-y-1">
          <p className="app-muted-text text-sm font-semibold uppercase">SGI • Qualidade</p>
          <h1 className="app-title">Não Conformidades</h1>
          <p className="app-subtitle max-w-3xl">
            Gerencie o ciclo completo de identificação, tratativa e verificação de eficácia.
          </p>
        </div>
        <div className="ml-auto w-full sm:w-auto">
          <Link
            href="/dashboard/sgi/qualidade/nao-conformidades/nova"
            className="app-button-primary w-full sm:w-auto"
          >
            Nova não conformidade
          </Link>
        </div>
      </header>
      <NaoConformidadesClient />
    </div>
  )
}
