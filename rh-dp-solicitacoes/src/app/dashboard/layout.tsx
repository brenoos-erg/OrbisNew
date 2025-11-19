// src/app/dashboard/layout.tsx
import type { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import UserMenu from '@/components/layout/userMenu'
import { ModuleLevel } from '@prisma/client'

type AccessMap = Record<string, ModuleLevel>

async function loadUserModuleAccess(userId: string): Promise<AccessMap> {
  const rows = await prisma.userModuleAccess.findMany({
    where: { userId },
    include: {
      module: { select: { key: true } },
    },
  })

  const map: AccessMap = {}
  for (const r of rows) {
    map[r.module.key] = r.level
  }
  return map
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { appUser } = await getCurrentAppUser()

  // se não tiver usuário logado, manda pro login
  if (!appUser) {
    redirect('/login')
  }

  // se estiver inativo, mesma regra que já existia
  if (appUser.status === 'INATIVO') {
    redirect('/login?inactive=1')
  }

  // cálculo de módulos liberados com base em UserModuleAccess
  let showSolic = false
  let showConfig = false
  let canApprove = false

  if (appUser.id) {
    const access = await loadUserModuleAccess(appUser.id)

    // se tiver qualquer nível no módulo, ele aparece no menu
    showSolic = !!access['solicitacoes']
    showConfig = !!access['configuracoes']

    // Aprovações só para quem tem NIVEL_3 no módulo de solicitações
    canApprove = access['solicitacoes'] === 'NIVEL_3'
  }

  return (
    <div className="dashboard-shell min-h-screen flex">
      <Sidebar
        showSolic={showSolic}
        showConfig={showConfig}
        canApprove={canApprove}
        userMenu={<UserMenu collapsed={false} />}
      />

      {/* conteúdo */}
      <main className="flex-1 flex flex-col">
        <div className="h-16 border-b border-slate-200 flex items-center px-6 text-sm text-slate-600">
          Sistema de Solicitações
        </div>
        <div className="p-6 flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  )
}
