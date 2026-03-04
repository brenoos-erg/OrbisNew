import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { listExperienceEvaluators } from '@/lib/experienceEvaluation'

export async function GET() {
  try {
    await requireActiveUser()
    const rows = await listExperienceEvaluators()
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/coordenadores error', error)
    return NextResponse.json(
      { error: 'Erro ao listar coordenadores.' },
      { status: 500 },
    )
  }
}