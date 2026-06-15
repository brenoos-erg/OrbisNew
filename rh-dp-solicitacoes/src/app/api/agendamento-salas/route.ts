export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'

const ROOMS = ['OURO', 'SOLAR', 'DIAMANTE'] as const
const STATUSES = ['AGENDADA', 'CANCELADA', 'CONCLUIDA'] as const
type MeetingRoomName = (typeof ROOMS)[number]
type MeetingRoomBookingStatus = (typeof STATUSES)[number]
const MIN_DURATION_MS = 15 * 60 * 1000
const MAX_DURATION_MS = 8 * 60 * 60 * 1000

export function hasMeetingRoomConflict(existing: { startsAt: Date; endsAt: Date }, startsAt: Date, endsAt: Date) {
  return existing.startsAt < endsAt && existing.endsAt > startsAt
}

function dayRange(date: string | null) {
  const base = date ? new Date(`${date}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return null
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

async function requireUser(action: Action, feature: string) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()
  if (!appUser) {
    return {
      response: NextResponse.json(
        dbUnavailable
          ? { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId }
          : { error: 'Não autenticado', requestId },
        { status: dbUnavailable ? 503 : 401 },
      ),
    }
  }
  const allowed = await canFeature(appUser.id, MODULE_KEYS.AGENDAMENTO_SALAS, feature, action)
  if (!allowed) {
    return { response: NextResponse.json({ error: 'Acesso negado ao agendamento de salas.', requestId }, { status: 403 }) }
  }
  return { appUser, requestId }
}

export async function GET(req: Request) {
  const auth = await requireUser(Action.VIEW, FEATURE_KEYS.AGENDAMENTO_SALAS.VISUALIZAR)
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const range = dayRange(searchParams.get('date'))
  if (!range) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })

  const room = searchParams.get('room')
  const status = searchParams.get('status')
  if (room && !ROOMS.includes(room as MeetingRoomName)) return NextResponse.json({ error: 'Sala inválida.' }, { status: 400 })
  if (status && !STATUSES.includes(status as MeetingRoomBookingStatus)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })

  const bookings = await (prisma as any).meetingRoomBooking.findMany({
    where: {
      startsAt: { lt: range.end },
      endsAt: { gt: range.start },
      ...(room ? { room: room as MeetingRoomName } : {}),
      ...(status ? { status: status as MeetingRoomBookingStatus } : {}),
    },
    orderBy: [{ startsAt: 'asc' }, { room: 'asc' }],
  })
  return NextResponse.json({ bookings })
}

export async function POST(req: Request) {
  const auth = await requireUser(Action.CREATE, FEATURE_KEYS.AGENDAMENTO_SALAS.MARCAR)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => null)
  const room = body?.room as MeetingRoomName
  const startsAt = new Date(body?.startsAt)
  const endsAt = new Date(body?.endsAt)
  const title = String(body?.title ?? '').trim()
  const meetingType = String(body?.meetingType ?? '').trim()

  if (!ROOMS.includes(room)) return NextResponse.json({ error: 'Sala inválida.' }, { status: 400 })
  if (!title || !meetingType) return NextResponse.json({ error: 'Informe título e tipo de reunião.' }, { status: 400 })
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    return NextResponse.json({ error: 'Data/hora inicial deve ser menor que a final.' }, { status: 400 })
  }
  const duration = endsAt.getTime() - startsAt.getTime()
  if (duration < MIN_DURATION_MS) return NextResponse.json({ error: 'Duração mínima de 15 minutos.' }, { status: 400 })
  if (duration > MAX_DURATION_MS) return NextResponse.json({ error: 'Duração máxima de 8 horas.' }, { status: 400 })
  if (startsAt < new Date()) return NextResponse.json({ error: 'Não é permitido agendar no passado.' }, { status: 400 })

  const conflict = await (prisma as any).meetingRoomBooking.findFirst({
    where: { room, status: 'AGENDADA', startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  })
  if (conflict) return NextResponse.json({ error: 'Sala já reservada nesse horário.' }, { status: 409 })

  const booking = await (prisma as any).meetingRoomBooking.create({
    data: {
      room,
      title,
      meetingType,
      description: body?.description ? String(body.description) : null,
      startsAt,
      endsAt,
      requesterName: body?.requesterName ? String(body.requesterName) : null,
      requesterEmail: body?.requesterEmail ? String(body.requesterEmail) : null,
      createdById: auth.appUser.id,
      createdByName: auth.appUser.fullName || auth.appUser.login || auth.appUser.email,
    },
  })
  return NextResponse.json({ booking, message: 'Agendamento criado com sucesso.' }, { status: 201 })
}
