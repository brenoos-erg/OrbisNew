import { readSessionFromCookies } from '@/lib/auth-local'

export async function isAuthenticated() {
  return Boolean(readSessionFromCookies())
}
