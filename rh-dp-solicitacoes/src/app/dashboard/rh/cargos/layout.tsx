import type { ReactNode } from 'react'
import { Action } from '@prisma/client'
import { redirect } from 'next/navigation'
import { requireActiveUser } from '@/lib/auth'
import { canAccessRhPositions } from '@/lib/rhPositionsAccess'

export default async function RhCargosLayout({ children }: { children: ReactNode }) {
  const user = await requireActiveUser()
  if (!(await canAccessRhPositions(user, Action.VIEW))) redirect('/dashboard')
  return children
}
