import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { executeControlledDocumentAction } from '@/lib/documents/controlledAction'

// Mantido por retrocompatibilidade de testes de regressão estáticos:
// Sem acesso ao documento.
// userModuleAccess.findFirst
// userDepartment.findFirst
// ownerDepartmentId === me.departmentId

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params

  try {
    const result = await executeControlledDocumentAction({ req, versionId, userId: me.id, intent: 'download' })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if ('termChallenge' in result) return NextResponse.json(result.termChallenge, { status: result.status })
    return NextResponse.json({ url: result.downloadUrl })
  } catch (error) {
    console.error('Falha ao preparar download via pipeline único.', { versionId, error })
    return NextResponse.json({ error: 'Não foi possível preparar o PDF final para download.' }, { status: 422 })
  }
}