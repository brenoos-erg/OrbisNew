// src/lib/auth.ts
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export async function getCurrentAppUser() {
  // cria client do Supabase usando cookies do Next
  const supabase = createServerComponentClient({
    cookies,
  })

   const { data: userResult, error: userError } = await supabase.auth.getUser()

  if (userError) {
    console.error('Erro ao buscar usuário autenticado', userError)
    return { appUser: null, session: null }
  }

  const sessionUser = userResult.user

  if (!sessionUser) {
    return { appUser: null, session: null }
  }

  const authId = sessionUser.id
  const email = sessionUser.email ?? undefined

  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session ?? null

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
        departmentId: true,
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
      departmentId: true,
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
