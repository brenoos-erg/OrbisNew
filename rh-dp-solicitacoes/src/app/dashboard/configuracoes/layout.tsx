// src/app/dashboard/configuracoes/layout.tsx
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { ModuleLevel } from '@prisma/client'

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1) Garante usuário logado (via Supabase/Prisma)
  const me = await requireActiveUser()

  // 2) Carrega usuário com departamento + acessos de módulo
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    include: {
      department: true,
      moduleAccesses: {
        include: { module: true },
      },
    },
  })

  if (!user) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Usuário não encontrado.
      </div>
    )
  }

  // 🔐 Regra 1: PRECISA ser do departamento de TI
  // aqui estou usando o code = '20' como TI (ajusta se for outro)
  const isTiDepartment = user.department?.code === '20'

  if (!isTiDepartment) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Apenas usuários do departamento de TI podem acessar CONFIGURAÇÕES.
      </div>
    )
  }

  // 🔐 Regra 2: precisa ter acesso ao módulo "configuracoes" e ser NIVEL_3
  const configAccess = user.moduleAccesses.find(
    (a) => a.module.key === 'configuracoes',
  )

  if (!configAccess || configAccess.level !== ModuleLevel.NIVEL_3) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        Você não tem permissão suficiente para acessar CONFIGURAÇÕES.
      </div>
    )
  }

  // ✅ Passou nas duas regras: TI + NIVEL_3 em CONFIGURACOES
  return <>{children}</>
}
