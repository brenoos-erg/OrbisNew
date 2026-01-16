export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, type NextRequest } from 'next/server'

import { buildReconcileResponse, reconcileAuthUsers } from '@/lib/reconcile-auth-users'


function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  const token = header?.split('Bearer ')[1]

  return !!secret && token === secret
}
async function handler(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado no ambiente.' },
      { status: 500 },
    )
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await reconcileAuthUsers({
      batchSize: req.nextUrl.searchParams.get('batchSize'),
    })

    return NextResponse.json(buildReconcileResponse(result))
  } catch (error) {
    console.error('Erro ao executar reconcile-auth-users', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    )
  }
}

export const GET = handler
export const POST = handler