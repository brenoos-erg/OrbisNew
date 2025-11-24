// rh-dp-solicitacoes/src/app/api/positions/route.ts
import { NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma';

/**
 * GET /api/positions
 * - Retorna todos os cargos cadastrados (tabela position)
 * - Ordenados por nome
 */
export async function GET() {
  const positions = await prisma.position.findMany({
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(positions);
}
