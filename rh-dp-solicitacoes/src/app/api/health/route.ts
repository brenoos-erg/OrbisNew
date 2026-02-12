import { NextResponse } from 'next/server'

export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL)
  const hasAuthSecret = Boolean(process.env.JWT_SECRET ?? process.env.AUTH_SECRET)
  return NextResponse.json({
    status: hasDb && hasAuthSecret ? 'ok' : 'missing-env',
    database: hasDb ? 'ok' : 'missing DATABASE_URL',
    auth: hasAuthSecret ? 'ok' : 'missing JWT_SECRET',
  })
}