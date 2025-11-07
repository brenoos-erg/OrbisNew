// Supabase Admin opcional e seguro (só backend)
import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ service_role

  if (!url || !key) return null // ← Sem env? seguimos sem Supabase Admin.

  try {
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  } catch (e) {
    console.error('[supabaseAdmin] init error:', e)
    return null
  }
}
