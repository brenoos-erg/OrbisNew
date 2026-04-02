import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error:
        'Rota desativada. Use /api/documents/versions/:versionId/controlled com intent=download para executar o pipeline único de PDF final.',
    },
    { status: 410 },
  )
}