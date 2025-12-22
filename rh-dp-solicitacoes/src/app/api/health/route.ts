// src/app/api/health/route.ts
// Endpoint simples para diagnosticar conectividade com Supabase e o banco (Prisma)
// Útil para ambientes como Vercel quando o login falhar por falta de variáveis ou
// indisponibilidade do banco.
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

const isDbDisabled = process.env.SKIP_PRISMA_DB === 'true'

function isDbUnavailableError(error: unknown) {
  return (
    isDbDisabled ||
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P1001' || error.code === 'P1002'))
  )
}

export async function GET() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

  const supabaseEnvOk = Boolean(supabaseUrl && supabaseAnonKey)

  const result: {
    database: { status: 'ok' | 'error'; message?: string; detail?: string }
    supabase: { status: 'ok' | 'missing-env'; message?: string }
  } = {
    database: { status: 'ok' },
    supabase: supabaseEnvOk
      ? { status: 'ok' }
      : {
          status: 'missing-env',
          message: 'Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no Vercel.',
        },
  }

  if (supabaseEnvOk) {
    // Verifica se a chave tem estrutura de JWT (3 partes separadas por ponto)
    const supabaseKeyLooksJwt = supabaseAnonKey.split('.').length >= 3

    if (!supabaseKeyLooksJwt) {
      result.supabase = {
        status: 'missing-env',
        message: 'Supabase ANON KEY aparentemente inválida. Confirme o valor no painel do Supabase.',
      }
    } else {
      // Apenas instancia para garantir que não há falhas na construção do client
      createClient(supabaseUrl, supabaseAnonKey)
    }
  }

  if (isDbDisabled) {
    result.database = {
      status: 'error',
      message:
        'Banco de dados desabilitado neste ambiente (SKIP_PRISMA_DB=true). Habilite DATABASE_URL para autenticar.',
    }

    return NextResponse.json(result, { status: 503 })
  }

  try {
    // SELECT 1 para validar conectividade com o pool configurado em DATABASE_URL
    await prisma.$queryRaw`SELECT 1`
  } catch (error: any) {
    const dbUnavailable = isDbUnavailableError(error)
    result.database = {
      status: 'error',
      message: dbUnavailable
        ? 'Banco de dados indisponível. Confira DATABASE_URL (pool do Supabase) no Vercel.'
        : 'Erro inesperado ao acessar o banco.',
      detail: error?.message,
    }

    return NextResponse.json(result, { status: dbUnavailable ? 503 : 500 })
  }

  return NextResponse.json(result)
}