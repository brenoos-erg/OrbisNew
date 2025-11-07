import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const u = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true }
  });
  // retorna vazio se não tiver ninguém
  return NextResponse.json(u ?? {});
}
