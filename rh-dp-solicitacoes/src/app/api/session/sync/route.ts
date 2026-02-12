export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: true, noop: true })
}