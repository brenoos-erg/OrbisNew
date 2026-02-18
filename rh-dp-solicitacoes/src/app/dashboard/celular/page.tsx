// src/app/dashboard/celular/page.tsx
import Link from 'next/link'
import { getCurrentAppUser } from '@/lib/auth'
import { MODULE_KEYS } from '@/lib/featureKeys'

type ModuleCard = {
  key: string
  name: string
  href: string
  fallbackKeys?: string[]
}

const MODULE_CARDS: ModuleCard[] = [
  { key: MODULE_KEYS.SOLICITACOES, name: 'Solicitações', href: '/dashboard/solicitacoes' },
  { key: MODULE_KEYS.CONFIGURACOES, name: 'Configurações', href: '/dashboard/configuracoes' },
  {
    key: MODULE_KEYS.FROTAS,
    name: 'Gestão de Frotas',
    href: '/dashboard/gestao-de-frotas',
    fallbackKeys: ['gestao_frotas'],
  },
  {
    key: MODULE_KEYS.RECUSA,
    name: 'Direito de Recusa',
    href: '/dashboard/direito-de-recusa',
    fallbackKeys: ['direito_de_recusa'],
  },
  {
    key: MODULE_KEYS.EQUIPAMENTOS_TI,
    name: 'Controle de Equipamentos TI',
    href: '/dashboard/controle-equipamentos-ti',
  },
   {
    key: MODULE_KEYS.SST,
    name: 'Não Conformidades',
    href: '/dashboard/sst/nao-conformidades',
  },
]

export default async function CelularPage() {
  const { appUser } = await getCurrentAppUser()
  const levels = appUser?.moduleLevels ?? {}

  const visibleModules = MODULE_CARDS.filter((module) => {
    if (levels[module.key]) return true
    return module.fallbackKeys?.some((fallback) => levels[fallback])
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pb-10 pt-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Acesso rápido</h1>
        <p className="text-sm text-slate-600">
          Toque em um módulo para continuar. Esta visualização foi otimizada para celular.
        </p>
      </header>

      {visibleModules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Nenhum módulo disponível para o seu usuário no momento.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {visibleModules.map((module) => (
            <Link
              key={module.key}
              href={module.href}
              className="flex min-h-[96px] items-center justify-center rounded-lg border-2 border-red-500 bg-white text-center text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-red-50"
            >
              {module.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
