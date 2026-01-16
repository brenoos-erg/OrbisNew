import { NextResponse } from 'next/server'

const notFoundPayload = { error: 'Rota indisponível.' }

function notFoundResponse() {
  return NextResponse.json(notFoundPayload, { status: 404 })
}

export function GET() {
  return notFoundResponse()
}

export function POST() {
  return notFoundResponse()
}

export function OPTIONS() {
  return notFoundResponse()
}
