// src/app/dashboard/configuracoes/layout.tsx

import { requireActiveUser } from '@/lib/auth'
import { ModuleLevel } from '@prisma/client'
import { getUserModuleContext } from '@/lib/moduleAccess'

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1) Garante usuário logado (via Supabase/Prisma)
  const me = await requireActiveUser()

   // 2) Carrega níveis de acesso do módulo
  const { levels } = await getUserModuleContext(me.id)
  // 🔐 Regra: precisa ter acesso ao módulo "configuracoes" (herdado do departamento ou sobrescrito)
  const configLevel = levels['configuracoes']
  const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

  if (
    configLevel === undefined ||
    order.indexOf(configLevel) < order.indexOf(ModuleLevel.NIVEL_1)
  ) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Você não tem permissão suficiente para acessar CONFIGURAÇÕES.
      </div>
    )
  }

  // ✅ Passou na regra: NIVEL_1+ em CONFIGURACOES
  return <div data-enter-as-tab="true">{children}</div>
}
