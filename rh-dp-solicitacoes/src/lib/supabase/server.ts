import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export function getSupabaseServer() {
  return createServerComponentClient({ cookies })
}