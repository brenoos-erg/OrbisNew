import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { requireActiveUser } from '@/lib/auth'
import { canAccessTiOperationalPanel } from '@/lib/tiSolicitations'

export default async function TiSolicitacoesLayout({ children }: { children: ReactNode }) {
  const me = await requireActiveUser()
  const allowed = canAccessTiOperationalPanel({
    role: me.role,
    departmentCode: me.department?.code,
    moduleLevels: me.moduleLevels,
  })

  if (!allowed) {
    redirect('/dashboard/solicitacoes/recebidas?forbidden=ti')
  }

  return <>{children}</>
}
