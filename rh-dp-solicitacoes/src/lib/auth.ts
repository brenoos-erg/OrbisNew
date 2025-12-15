// src/lib/auth.ts
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUserModuleLevels } from '@/lib/moduleAccess'

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

 // usa apenas getUser() para garantir que os dados estejam autenticados via Supabase
  const session = sessionUser ? { user: sessionUser } : null

  let appUser = null
  let dbUnavailable = false

  try {
    // 1) tenta achar pelo authId
    appUser = await prisma.user.findFirst({
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
        department: { select: { id: true, code: true, name: true } },
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
          department: { select: { id: true, code: true, name: true } },
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error('Não foi possível conectar ao banco de dados para buscar usuário', error)
      dbUnavailable = true
    } else {
      console.error('Erro ao buscar usuário no banco de dados', error)
    }

     return { appUser: null, session, dbUnavailable }
  }
  if (appUser) {
    const moduleLevels = await getUserModuleLevels(appUser.id)
    return { appUser: { ...appUser, moduleLevels }, session, dbUnavailable }
  }

  return { appUser, session, dbUnavailable }
}

export async function requireActiveUser() {
  const { appUser, dbUnavailable } = await getCurrentAppUser()

  if (!appUser) {
    if (dbUnavailable) {
      throw new Error('Serviço indisponível. Não foi possível conectar ao banco de dados.')
    }
    throw new Error('Usuário não autenticado')
  }

  if (appUser.status !== 'ATIVO') {
    throw new Error('Usuário inativo')
  }

  return appUser
}
