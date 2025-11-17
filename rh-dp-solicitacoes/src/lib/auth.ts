// src/lib/auth.ts
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export async function getCurrentAppUser() {
  // cria client do Supabase usando cookies do Next
  const supabase = createServerComponentClient({
    cookies,
  })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return { appUser: null, session: null }
  }

  const authId = session.user.id
  const email = session.user.email ?? undefined

  // 1) tenta achar pelo authId
  let appUser = await prisma.user.findFirst({
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

  // 2) se não achar, tenta pelo e-mail e “cola” o authId nele
  if (!appUser && email) {
    const userByEmail = await prisma.user.findUnique({
      where: { email },
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

    if (userByEmail) {
      await prisma.user.update({
        where: { id: userByEmail.id },
        data: { authId },
      })

      appUser = userByEmail
    }
  }

  return { appUser, session }
}

export async function requireActiveUser() {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    throw new Error('Usuário não autenticado')
  }

  if (appUser.status !== 'ATIVO') {
    throw new Error('Usuário inativo')
  }

  return appUser
}
