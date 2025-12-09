// src/app/dashboard/layout.tsx
import type { ReactNode } from 'react'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import UserMenu from '@/components/layout/userMenu'
import {
  loadUserModuleAccess,
  userHasDepartmentOrCostCenter,
} from '@/lib/moduleAccess'
export const dynamic = 'force-dynamic'

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
  let showFleet = false

 if (appUser.id) {
    const [access, hasStructure] = await Promise.all([
      loadUserModuleAccess(appUser.id),
      userHasDepartmentOrCostCenter(
        appUser.id,
        appUser.costCenterId,
        appUser.departmentId,
      ),
    ])

    // se tiver qualquer nível no módulo, ele aparece no menu
    showSolic = !!access['solicitacoes'] && hasStructure
    showConfig = !!access['configuracoes']

    const fleetAccess = access['gestao-de-frotas'] ?? access['gestao_frotas']
    showFleet = !!fleetAccess

    // Aprovações só para quem tem NIVEL_3 no módulo de solicitações
     canApprove = access['solicitacoes'] === 'NIVEL_3' && hasStructure
  }

  return (
    <div className="dashboard-shell min-h-screen flex">
      <Sidebar
        showSolic={showSolic}
        showConfig={showConfig}
        showFleet={showFleet}
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
