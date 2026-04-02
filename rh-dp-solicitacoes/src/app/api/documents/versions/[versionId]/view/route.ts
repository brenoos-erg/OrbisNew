import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Rota desativada. Use /api/documents/versions/:versionId/controlled com intent=view para executar o pipeline único de PDF final.',
    },
    { status: 410 },
  )
}