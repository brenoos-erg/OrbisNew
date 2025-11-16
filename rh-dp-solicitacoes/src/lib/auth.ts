// src/lib/auth.ts
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export async function getCurrentAppUser() {
  // ❌ NÃO usar: const cookieStore = cookies()
  // ✅ Passa a função `cookies` direto para o helper
  
  const supabase = createServerComponentClient({
    cookies, // nada de cookies()
  })
  

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { appUser: null, session: null }
  }

  const authId = session.user.id

  const appUser = await prisma.user.findFirst({
    where: { authId },
    select: {
      id: true,
      email: true,
      fullName: true,
      login: true,
      phone: true,
      status: true,
      role: true,
      costCenterId: true,
    },
  })

  return { appUser, session }
}
export async function requireActiveUser() {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    throw new Error('Usuário não autenticado')
  }

  return appUser
}
