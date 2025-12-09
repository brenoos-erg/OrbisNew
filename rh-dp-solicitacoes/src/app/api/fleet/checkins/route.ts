import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
        { status: 400 }
      )
    }

    const inspectionDateTime = buildInspectionDateTime(inspectionDate, inspectionTime)
    const normalizedPlate = String(vehiclePlate).trim().toUpperCase()
    const normalizedType = vehicleType ?? 'VEICULO_LEVE'

    const { fatigueScore, fatigueRisk, driverStatus } = calculateFatigue(fatigue)

    const itemsWithProblem = (vehicleChecklist as Array<{ status?: string }>).filter(
      (item) => item.status?.toUpperCase() === 'COM_PROBLEMA'
    )
    const hasVehicleProblem = itemsWithProblem.length > 0
    const hasNonConformityBool = String(hasNonConformity).toUpperCase() === 'SIM'

    // O status do veículo depende apenas de problemas mecânicos/itens do checklist ou não conformidade.
    const vehicleStatus =
      hasVehicleProblem || hasNonConformityBool ? 'RESTRITO' : 'DISPONIVEL'

    let vehicle = await prisma.vehicle.findUnique({
      where: { plate: normalizedPlate },
    })

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          plate: normalizedPlate,
          type: normalizedType,
          kmCurrent: vehicleKm,
          status: 'DISPONIVEL',
        },
      })
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

    // Futuro: envio de e-mail/alerta poderia ser disparado aqui após o registro.

    return NextResponse.json({
      vehicleStatus,
      driverStatus,
      fatigueScore,
      fatigueRisk,
    })
  } catch (error) {
    console.error('Erro ao registrar check-in de veículo', error)
    return NextResponse.json(
      { error: 'Erro ao registrar check-in' },
      { status: 500 }
    )
  }
}