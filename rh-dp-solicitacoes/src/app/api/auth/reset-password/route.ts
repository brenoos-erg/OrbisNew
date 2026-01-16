import { NextResponse } from 'next/server'

const notFoundPayload = { error: 'Rota indisponível.' }

export function GET() {
  return NextResponse.json(notFoundPayload, { status: 404 })
}

export function POST() {
  return NextResponse.json(notFoundPayload, { status: 404 })
}