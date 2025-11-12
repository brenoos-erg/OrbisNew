import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export async function getCurrentAppUser() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({
    cookies: () => cookieStore,  // ✅ função
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { appUser: null, session: null }

  const authId = session.user.id

  const appUser = await prisma.user.findFirst({
    where: { authId },
    select: {
      id: true, email: true, fullName: true, login: true, phone: true,
      status: true, role: true, costCenterId: true,
    },
  })

  return { appUser, session }
}
