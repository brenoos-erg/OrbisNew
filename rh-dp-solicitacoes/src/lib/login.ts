import { prisma } from '@/lib/prisma'

// remove acentos e caracteres não alfanuméricos
function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

export async function generateLoginFromFullName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'usuario'

  const first = slugify(parts[0])
  const last  = slugify(parts[parts.length - 1])
  let base = `${first}.${last}`

  // garante unicidade
  let login = base
  let i = 1
  // tenta achar conflito
  while (true) {
    const exists = await prisma.user.findUnique({ where: { login } })
    if (!exists) break
    i += 1
    login = `${base}-${i}`
  }
  return login
}
