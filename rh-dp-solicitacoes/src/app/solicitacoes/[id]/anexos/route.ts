// src/app/api/solicitacoes/[id]/anexos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// se estiver usando edge runtime em outros lugares, aqui força node
export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const solicitationId = params.id

    if (!solicitationId) {
      return NextResponse.json(
        { error: 'ID da solicitação não informado' },
        { status: 400 },
      )
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { ok: true, message: 'Nenhum arquivo enviado' },
        { status: 200 },
      )
    }

    // ⚠️ Aqui é onde você faria o upload real (S3, disco, etc.)
    // Por enquanto, vamos só simular uma URL e salvar no banco.
    const attachmentsData = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        // TODO: salvar "buffer" em algum storage e gerar a URL verdadeira

        const fakeUrl = `/uploads/${encodeURIComponent(file.name)}`

        return {
          id: randomUUID(),
          solicitationId,
          filename: file.name,
          url: fakeUrl,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }
      }),
    )

    await prisma.attachment.createMany({
      data: attachmentsData,
    })

    return NextResponse.json({
      ok: true,
      count: attachmentsData.length,
    })
  } catch (e) {
    console.error('Erro ao receber anexos:', e)
    return NextResponse.json(
      { error: 'Erro ao receber anexos.' },
      { status: 500 },
    )
  }
}
