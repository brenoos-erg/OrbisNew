// src/app/dashboard/layout.tsx
import type { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import UserMenu from '@/components/layout/userMenu'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { appUser } = await getCurrentAppUser()
  if (appUser && appUser.status === 'INATIVO') {
    redirect('/login?inactive=1')
  }

  // ... seu cálculo de showSolic/showConfig por cost centers ...
  let showSolic = false
  let showConfig = false
  if (appUser?.id) {
    const links = await prisma.userCostCenter.findMany({
      where: { userId: appUser.id },
      select: { costCenterId: true },
    })
    const ccIds = new Set<string>(links.map(l => l.costCenterId))
    if (appUser.costCenterId) ccIds.add(appUser.costCenterId)

    if (ccIds.size > 0) {
      const rows = await prisma.costCenterModule.findMany({
        where: { costCenterId: { in: [...ccIds] } },
        include: { module: { select: { key: true } } },
      })
      const enabled = new Set(rows.map(r => r.module.key))
      showSolic = enabled.has('solicitacoes')
      showConfig = enabled.has('configuracoes')
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex">
      <Sidebar showSolic={showSolic} showConfig={showConfig} userMenu={<UserMenu collapsed={false} />} />
      <main className="flex-1 bg-white ml-16 md:ml-72 transition-all">
        <div className="h-16 border-b border-slate-200 flex items-center px-6 text-sm text-slate-600">
          Sistema de Solicitações
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
