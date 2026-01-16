import { NextResponse } from 'next/server'

type JsonApiErrorInput = {
  status: number
  message: string
  dbUnavailable: boolean
  requestId?: string
}

export function jsonApiError({ status, message, dbUnavailable, requestId }: JsonApiErrorInput) {
  return NextResponse.json(
    {
      error: message,
      dbUnavailable,
      requestId,
    },
    { status },
  )
}