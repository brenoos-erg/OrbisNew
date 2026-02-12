import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: false, message: 'Job desativado após remoção do Supabase.' }, { status: 410 })
}