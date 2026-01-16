export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'

import { buildVehicleChecklistEmailContent } from '@/lib/emails/checklist'
import { sendMail } from '@/lib/mailer'

export async function GET() {
  const recipients = ['brenoos@ergengenharia.com.br']

  const { subject, text } = buildVehicleChecklistEmailContent({
    inspectionDate: '2025-12-10',
    driverName: 'Fulano',
    vehiclePlate: 'ABC1A23',
    vehicleType: '4x4',
    vehicleKm: 150000,
    itemsWithProblem: [{ label: 'Freio com problema' }],
    driverStatus: 'INAPTO',
    fatigueRisk: 'GRAVE',
  })

  const result = await sendMail({ to: recipients, subject, text })

  return NextResponse.json(result)
}