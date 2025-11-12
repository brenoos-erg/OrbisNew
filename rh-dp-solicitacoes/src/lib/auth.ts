// src/lib/auth.ts
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'
// import type { Database } from '@/types_supabase' // se você tiver o tipo

export async function getCurrentAppUser() {
  // ✅ Next 15: cookies() é assíncrono
  const cookieStore = await cookies()

  // ✅ injete uma função que devolve o cookieStore
  const supabase = createServerComponentClient/*<Database>*/({
    cookies: () => cookieStore,
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { session: null, appUser: null }

  // Seu lookup no Prisma
  const appUser = await prisma.user.findFirst({
    where: { authId: session.user.id },
    select: { id: true, fullName: true, email: true, login: true, status: true, costCenterId: true },
  })

  return { session, appUser }
}
