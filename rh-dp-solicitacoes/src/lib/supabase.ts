
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedServerClient: SupabaseClient | null = null

export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Supabase URL não configurada. Defina NEXT_PUBLIC_SUPABASE_URL.')
  }

  if (!supabaseKey) {
    throw new Error(
      'Chave do Supabase não configurada. Defina SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  if (!cachedServerClient) {
    cachedServerClient = createClient(supabaseUrl, supabaseKey)
  }

  return cachedServerClient
}