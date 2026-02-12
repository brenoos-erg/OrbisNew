import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: false, message: 'Reconcile com Supabase foi desativado.' }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ ok: false, message: 'Reconcile com Supabase foi desativado.' }, { status: 410 })
}