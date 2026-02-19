export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const me = await requireActiveUser()
  const assignment = await prisma.documentAssignment.findFirst({
    where: { id: (await params).assignmentId, userId: me.id },
    include: { document: { select: { signedPdfUrl: true } } },
  })

  if (!assignment) {
    return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
  }

  return NextResponse.json({
    status: assignment.status,
    signedAt: assignment.signedAt,
    signedPdfUrl: assignment.document.signedPdfUrl,
  })
}