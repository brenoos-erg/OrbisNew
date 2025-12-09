// src/app/dashboard/configuracoes/layout.tsx
import { prisma } from '@/lib/prisma'
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

   // 2) Carrega usuário com departamento para a regra de TI
  const [user, { levels, departmentCode }] = await Promise.all([
    prisma.user.findUnique({
      where: { id: me.id },
      include: { department: true },
    }),
    getUserModuleContext(me.id),
  ])

  if (!user) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Usuário não encontrado.
      </div>
    )
  }

 // 🔐 Regra 1: PRECISA ser do departamento de TI (code = "TI")
  const isTiDepartment = departmentCode === 'TI'

  if (!isTiDepartment) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Apenas usuários do departamento de TI podem acessar CONFIGURAÇÕES.
      </div>
    )
  }

// 🔐 Regra 2: precisa ter acesso ao módulo "configuracoes" (herdado do departamento ou sobrescrito)
  const configLevel = levels['configuracoes']
  const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']

  if (configLevel === undefined || order.indexOf(configLevel) < order.indexOf(ModuleLevel.NIVEL_1)) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Você não tem permissão suficiente para acessar CONFIGURAÇÕES.
      </div>
    )
  }

  // ✅ Passou nas duas regras: TI + NIVEL_1+ em CONFIGURACOES
  return <>{children}</>
}
