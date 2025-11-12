import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

// Se você não tem um tipo Database do Supabase, não tipa o client.
export async function getCurrentAppUser() {
  const supabase = createServerComponentClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return { session: null, appUser: null }

  // auth.users.id é UUID; sua tabela User guarda isso em "authId"
  const appUser = await prisma.user.findFirst({
    where: { authId: session.user.id },
    select: { id: true, fullName: true, email: true, login: true, status: true, costCenterId: true },
  })


  return { session, appUser }
}
