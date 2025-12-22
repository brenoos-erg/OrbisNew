import { NextResponse } from 'next/server'
import { sendMail } from '@/lib/mailer'

export async function GET() {
  const result = await sendMail({
    to: ['brenoos@ergengenharia.com.br'],
    subject: 'Teste de e-mail - Orbis',
    text: 'Se chegou, o Resend está configurado corretamente.',
  })

  return NextResponse.json(result)
}
