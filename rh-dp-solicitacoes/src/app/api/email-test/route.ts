export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

import { sendMail } from '@/lib/mailer'

export async function GET(request: NextRequest) {
  const toParam = request.nextUrl.searchParams.get('to')
  const recipients = toParam
    ? toParam
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : ['brenoos@ergengenharia.com.br']

  const subject = request.nextUrl.searchParams.get('subject')?.trim() || '[Teste] Integração de e-mail'
  const text = request.nextUrl.searchParams.get('body')?.trim() || 'Teste de envio via endpoint /api/email-test.'

  const result = await sendMail({
    to: recipients,
    subject,
    text,
  })

  return NextResponse.json(result)
}