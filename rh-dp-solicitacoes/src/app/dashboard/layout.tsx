// src/app/dashboard/layout.tsx
import type { ReactNode } from 'react'
import { getCurrentAppUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import UserMenu from '@/components/layout/userMenu'
import {
  getUserModuleContext,
  userHasDepartmentOrCostCenter,
} from '@/lib/moduleAccess'
import { ModuleLevel } from '@prisma/client'
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
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

  const hasMinLevel = (level: ModuleLevel | undefined, min: ModuleLevel) => {
    const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
    const current = level ? order.indexOf(level) : -1
    return current >= order.indexOf(min)
  }

  // cálculo de módulos liberados com base na soma Departamento (NIVEL_1) + UserModuleAccess (sobrescrita)
  let showSolic = false
  let showConfig = false
  let showConfigPermissions = false
  let canApprove = false
  let showFleet = false

  if (appUser.id) {
    const [{ levels, departmentCode }, hasStructure] = await Promise.all([
      getUserModuleContext(appUser.id),
      userHasDepartmentOrCostCenter(
        appUser.id,
        appUser.costCenterId,
        appUser.departmentId,
      ),
    ])

    const solicitLevel = levels['solicitacoes']
    const configLevel = levels['configuracoes']
    const fleetLevel = levels['gestao-de-frotas'] ?? levels['gestao_frotas']
    const isTi = departmentCode === 'TI'

    // Módulos aparecem com nível final >= NIVEL_1 (departamento já libera)
    showSolic = hasMinLevel(solicitLevel, ModuleLevel.NIVEL_1) && hasStructure
    showConfigPermissions = hasMinLevel(configLevel, ModuleLevel.NIVEL_3)
    
    // Exibe o menu de Configurações para TI ou para usuários com acesso total
    // ao módulo, garantindo que quem pode acessar Permissões também veja o menu
    showConfig =
      (isTi && hasMinLevel(configLevel, ModuleLevel.NIVEL_1)) ||
      showConfigPermissions
    showFleet = hasMinLevel(fleetLevel, ModuleLevel.NIVEL_1)
    showFleet = hasMinLevel(fleetLevel, ModuleLevel.NIVEL_1)

    // Aprovações só para quem tem NIVEL_3 no módulo de solicitações
    canApprove = hasMinLevel(solicitLevel, ModuleLevel.NIVEL_3) && hasStructure
  }

  return (
    <div className="dashboard-shell min-h-screen flex">
      <Sidebar
        showSolic={showSolic}
        showConfig={showConfig}
        showConfigPermissions={showConfigPermissions}
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