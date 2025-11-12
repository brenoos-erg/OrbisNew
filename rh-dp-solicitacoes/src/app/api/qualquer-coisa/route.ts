// src/app/api/qualquer-coisa/route.ts
import { requireActiveUser } from '@/lib/guards'
import { NextResponse } from 'next/server'

export async function GET() {
  const g = await requireActiveUser()
  if (!g.ok) return g.response

  // ... lógica da rota (g.user está ativo)
  return NextResponse.json({ ok: true })
}
