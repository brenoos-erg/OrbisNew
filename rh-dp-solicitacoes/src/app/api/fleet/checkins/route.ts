export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { ModuleLevel, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import { sendMail } from '@/lib/mailer'

export const runtime = 'nodejs'

const fatiguePoints: Record<string, number> = {
  '31': 5,
  '32': 30,
  '33': 5,
  '34': 5,
  '35': 5,
  '36': 5,
  '37': 5,
  '38': 30,
  '39': 5,
  '40': 5,
}

type ChecklistItem = {
  name?: string
  label?: string
  status?: string
  category?: string
}

function buildInspectionDateTime(date: string, time?: string) {
  const normalizedTime = time && time.trim() !== '' ? time : '00:00'
  return new Date(`${date}T${normalizedTime}:00`)
}

function calculateFatigue(fatigue: Array<{ name: string; answer?: string }>) {
  const fatigueScore = fatigue.reduce((score, item) => {
    if (item.answer?.toUpperCase() === 'SIM') {
      return score + (fatiguePoints[item.name] ?? 0)
    }
    return score
  }, 0)

  let fatigueRisk: 'LEVE' | 'TOLERAVEL' | 'GRAVE' = 'LEVE'
  let driverStatus: 'APTO' | 'INAPTO' = 'APTO'

  if (fatigueScore >= 30) {
    fatigueRisk = 'GRAVE'
    driverStatus = 'INAPTO'
  } else if (fatigueScore >= 20) {
    fatigueRisk = 'TOLERAVEL'
  }

  return { fatigueScore, fatigueRisk, driverStatus }
}

async function findConfigLevel3Emails() {
  const configModule = await prisma.module.findFirst({
    where: { key: { equals: 'configuracoes', mode: 'insensitive' } },
  })

  if (!configModule) {
    console.warn('[checkins][notify] Module "configuracoes" not found')
    return [] as string[]
  }

  const accesses = await prisma.userModuleAccess.findMany({
    where: { moduleId: configModule.id, level: ModuleLevel.NIVEL_3 },
    include: { user: { select: { email: true } } },
  })

  const emails = accesses
    .map((access) => access.user?.email)
    .filter((email): email is string => Boolean(email))

  return Array.from(new Set(emails))
}

function buildEmailContent({
  inspectionDate,
  inspectionTime,
  driverName,
  vehiclePlate,
  vehicleType,
  vehicleKm,
  itemsWithProblem,
  driverStatus,
  fatigueRisk,
  nonConformityCriticality,
  nonConformityActions,
  nonConformityManager,
  nonConformityHandlingDate,
}: {
  inspectionDate: string
  inspectionTime?: string
  driverName?: string | null
  vehiclePlate: string
  vehicleType?: string | null
  vehicleKm: number
  itemsWithProblem: ChecklistItem[]
  driverStatus: 'APTO' | 'INAPTO'
  fatigueRisk: 'LEVE' | 'TOLERAVEL' | 'GRAVE'
  nonConformityCriticality?: string | null
  nonConformityActions?: string | null
  nonConformityManager?: string | null
  nonConformityHandlingDate?: string | null
}) {
  const formattedDate = inspectionDate || '—'
  const formattedTime = inspectionTime && inspectionTime !== '' ? inspectionTime : '—'
  const formattedKm = Number.isFinite(vehicleKm) ? vehicleKm.toLocaleString('pt-BR') : '—'

  const issues =
    itemsWithProblem
      .map((item) => item.label || item.name)
      .filter(Boolean)
      .map((label) => `- ${label}`)
      .join('\n') || '- Item crítico não informado'

  const baseIntro =
    driverStatus === 'INAPTO'
      ? 'Foi identificado um motorista inapto durante o preenchimento do Checklist de Veículos – ERG.'
      : 'Foi identificada uma não conformidade durante o preenchimento do Checklist de Veículos – ERG.'

  const nonConformityBlock = [
    driverStatus === 'INAPTO'
      ? `Descrição: Checklist de fadiga indicou motorista INAPTO (risco ${fatigueRisk}).`
      : `Descrição: ${issues}`,
    `Criticidade: ${
      nonConformityCriticality || (driverStatus === 'INAPTO' ? 'Motorista inapto' : 'Item crítico')
    }`,
    `Medidas Tomadas: ${
      nonConformityActions ||
      (driverStatus === 'INAPTO'
        ? 'Substituir o condutor ou aguardar liberação do gestor.'
        : 'Item sinalizado e será informado ao gestor')
    }`,
    `Gestor Responsável: ${nonConformityManager || 'Gestor responsável não informado'}`,
    `Data da Tratativa: ${nonConformityHandlingDate || formattedDate}`,
  ].join('\n')

  const text = [
    baseIntro,
    'Segue o resumo das informações registradas:',
    '',
    '📌 Dados do Checklist',
    `Data da inspeção: ${formattedDate}`,
    `Horário: ${formattedTime}`,
    '',
    '👤 Dados do Motorista',
    `Nome: ${driverName || '—'}`,
    `Status: ${driverStatus}`,
    driverStatus === 'INAPTO' ? `Risco de fadiga: ${fatigueRisk}` : undefined,
    '',
    '🚚 Dados do Veículo',
    `${vehicleType || 'Veículo'} / Tipo: ${vehicleType || '—'}`,
    `Placa: ${vehiclePlate}`,
    `KM / Horímetro: ${formattedKm}`,
    '',
    driverStatus === 'INAPTO' ? '⚠️ Motorista Inapto' : '⚠️ Não Conformidade',
    nonConformityBlock,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n')

  return {
    subject: driverStatus === 'INAPTO' ? 'Alerta: motorista inapto' : 'Alerta de check-in de veículo',
    text,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId') ?? undefined

  const checkins = await prisma.vehicleCheckin.findMany({
    where: {
      ...(vehicleId ? { vehicleId } : {}),
    },
    include: {
      vehicle: { select: { plate: true, type: true, status: true } },
      driver: { select: { fullName: true, email: true } },
    },
    orderBy: { inspectionDate: 'desc' },
  })

  return NextResponse.json(checkins)
}

export async function POST(req: Request) {
  try {
    const { appUser } = await getCurrentAppUser()

    if (!appUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()

    const {
      inspectionDate,
      inspectionTime,
      costCenter,
      sectorActivity,
      driverName,
      vehicleType,
      vehiclePlate,
      vehicleKm,
      vehicleChecklist = [],
      fatigue = [],
      hasNonConformity = 'NAO',
      nonConformityCriticality,
      nonConformityActions,
      nonConformityManager,
      nonConformityHandlingDate,
    } = body ?? {}

    if (!inspectionDate || !vehiclePlate || typeof vehicleKm !== 'number') {
      return NextResponse.json(
        { error: 'Dados obrigatórios ausentes (data, placa ou quilometragem).' },
        { status: 400 },
      )
    }

    const inspectionDateTime = buildInspectionDateTime(inspectionDate, inspectionTime)
    const normalizedPlate = String(vehiclePlate).trim().toUpperCase()
    const normalizedType = vehicleType ?? 'VEICULO_LEVE'

    const { fatigueScore, fatigueRisk, driverStatus } = calculateFatigue(fatigue)

    const itemsWithProblem = (vehicleChecklist as ChecklistItem[]).filter(
      (item) =>
        item.category?.toUpperCase() === 'CRITICO' &&
        item.status?.toUpperCase() === 'COM_PROBLEMA',
    )

    const hasVehicleProblem = itemsWithProblem.length > 0
    const hasNonConformityBool = String(hasNonConformity).toUpperCase() === 'SIM'

    const vehicleStatus = hasVehicleProblem || hasNonConformityBool ? 'RESTRITO' : 'DISPONIVEL'

    const vehicle = await prisma.vehicle.findUnique({
      where: { plate: normalizedPlate },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Placa não cadastrada. Cadastre o veículo antes do check-in.' },
        { status: 400 },
      )
    }

    if (typeof vehicleKm === 'number' && vehicleKm < vehicle.kmCurrent) {
      return NextResponse.json(
        { error: 'A quilometragem informada é inferior ao último registro do veículo.' },
        { status: 400 },
      )
    }

    if (driverName && driverName !== appUser.fullName) {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { fullName: driverName },
      })
    }

    if (vehicle.status === 'RESTRITO' && vehicleStatus === 'DISPONIVEL') {
      if (!nonConformityActions || !nonConformityHandlingDate) {
        return NextResponse.json(
          {
            error:
              'Veículo restrito requer tratativa: informe ações e data de tratativa para liberar o veículo.',
          },
          { status: 400 },
        )
      }
    }

    await prisma.vehicleCheckin.create({
      data: {
        vehicleId: vehicle.id,
        driverId: appUser.id,
        inspectionDate: inspectionDateTime,
        costCenter,
        sectorActivity,
        driverName,
        vehiclePlateSnapshot: normalizedPlate,
        vehicleTypeSnapshot: normalizedType,
        kmAtInspection: vehicleKm,
        vehicleStatus,
        checklistJson: vehicleChecklist,
        fatigueJson: fatigue,
        fatigueScore,
        fatigueRisk,
        driverStatus,
        hasNonConformity: hasNonConformityBool,
        nonConformityCriticality,
        nonConformityActions,
        nonConformityManager,
        nonConformityDate:
          nonConformityHandlingDate && nonConformityHandlingDate !== ''
            ? new Date(nonConformityHandlingDate)
            : undefined,
      },
    })

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        kmCurrent: vehicleKm,
        status: vehicleStatus,
      },
    })

    const shouldNotify = hasVehicleProblem || hasNonConformityBool || driverStatus === 'INAPTO'

    console.info('[checkins][notify] shouldNotify', shouldNotify)

    if (shouldNotify) {
      const recipients = await findConfigLevel3Emails()

      console.info('[checkins][notify] recipients', recipients)

      if (recipients.length > 0) {
        const { subject, text } = buildEmailContent({
          inspectionDate,
          inspectionTime,
          driverName: driverName || appUser.fullName,
          vehiclePlate: normalizedPlate,
          vehicleType: normalizedType,
          vehicleKm,
          itemsWithProblem,
          driverStatus,
          fatigueRisk,
          nonConformityCriticality,
          nonConformityActions,
          nonConformityManager: nonConformityManager || appUser.fullName,
          nonConformityHandlingDate,
        })

        try {
          const mailResult = await sendMail({ to: recipients, subject, text })

          if (!mailResult.sent) {
            console.warn('Falha ao enviar alerta de check-in', mailResult.error)
          }
        } catch (error) {
          console.error('Erro ao enviar alerta de check-in', error)
        }
        } else {
        console.warn('[checkins][notify] Nenhum destinatário encontrado para NIVEL_3 em configuracoes')
      }
    }

    return NextResponse.json({
      vehicleStatus,
      driverStatus,
      fatigueScore,
      fatigueRisk,
    })
  } catch (error) {
    console.error('Erro ao registrar check-in de veículo', error)
    return NextResponse.json({ error: 'Erro ao registrar check-in' }, { status: 500 })
  }
}
