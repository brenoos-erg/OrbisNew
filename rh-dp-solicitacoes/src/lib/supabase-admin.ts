import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type SupabaseAdminClient = SupabaseClient

// Admin client (Service Role) – só no servidor. Retorna null se não houver credenciais.
export function getSupabaseAdmin(): SupabaseAdminClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn('Supabase admin credentials missing; skipping Auth sync.')
    return null
  }

  return createClient(url, key, { auth: { persistSession: false } })
}

// Busca usuário no Auth por email (compatível com versões antigas do SDK)
export async function findAuthUserIdByEmail(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
) {
  const target = email.trim().toLowerCase()

  let page = 1
  const perPage = 1000

  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)

    const found = (data?.users ?? []).find(
      (u) => (u.email ?? '').toLowerCase() === target,
    )
    if (found?.id) return found.id

    if (!data?.users || data.users.length < perPage) break
    page++
  }

  return null
}