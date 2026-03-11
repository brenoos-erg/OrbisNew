import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nextSolicitationProtocolo } from '@/lib/protocolo'

async function saveFile(file: File, folder: string) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name) || '.bin'
  const name = `${randomUUID()}${ext}`
  const relPath = `/uploads/${folder}/${name}`
  const absPath = path.join(process.cwd(), 'public', relPath)
  await mkdir(path.dirname(absPath), { recursive: true })
  await writeFile(absPath, bytes)
  return relPath
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const tipoId = String(form.get('tipoId') ?? '').trim()
    const camposRaw = String(form.get('campos') ?? '{}')
    const campos = JSON.parse(camposRaw) as Record<string, string>

    if (!tipoId) {
      return NextResponse.json({ error: 'Tipo é obrigatório.' }, { status: 400 })
    }

    const tipo = await prisma.tipoSolicitacao.findUnique({ where: { id: tipoId } })
    if (!tipo) {
      return NextResponse.json({ error: 'Tipo de solicitação não encontrado.' }, { status: 404 })
    }

    const meta = ((tipo.schemaJson as { meta?: { allowExternalAccess?: boolean; departamentos?: string[] } })?.meta ?? {})
    if (!meta.allowExternalAccess) {
      return NextResponse.json({ error: 'Tipo de solicitação não disponível para acesso externo.' }, { status: 403 })
    }

    const departmentId = Array.isArray(meta.departamentos) ? meta.departamentos[0] : null
    if (!departmentId) {
      return NextResponse.json({ error: 'Departamento do tipo não configurado.' }, { status: 400 })
    }

    const externalUser = await prisma.user.findFirst({
      where: { email: 'externo.solicitacoes@ergengenharia.com.br' },
      select: { id: true },
    })

    if (!externalUser) {
      return NextResponse.json(
        { error: 'Usuário técnico externo não configurado. Execute o seed para criar o usuário.' },
        { status: 500 },
      )
    }

    const protocolo = await nextSolicitationProtocolo()
    const created = await prisma.solicitation.create({
      data: {
        protocolo,
        tipoId: tipo.id,
        departmentId,
        solicitanteId: externalUser.id,
        titulo: tipo.nome,
        descricao: 'Solicitação aberta por formulário externo.',
        payload: {
          solicitarParaOutroColaborador: false,
          solicitante: {
            fullName: (campos.nome || 'Solicitante externo').trim(),
            email: (campos.email || 'nao-informado@externo.local').trim(),
            login: 'externo.portal',
            phone: (campos.telefone || '').trim(),
            positionName: 'Externo',
            departmentName: 'Externo',
            leaderName: '',
            costCenterId: '',
            costCenterText: '',
          },
          campos,
          origemExterna: true,
        },
      },
    })

    const files = form.getAll('files').filter((value): value is File => value instanceof File)
    for (const file of files) {
      const url = await saveFile(file, 'solicitacoes')
      await prisma.attachment.create({
        data: {
          id: randomUUID(),
          solicitationId: created.id,
          filename: file.name,
          url,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
      })
    }

    await prisma.event.create({
      data: {
        id: randomUUID(),
        solicitationId: created.id,
        actorId: externalUser.id,
        tipo: 'CRIACAO_EXTERNA',
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: created.id,
        status: 'ABERTA',
        message: 'Solicitação criada por acesso externo.',
      },
    })

    return NextResponse.json({ id: created.id, protocolo: created.protocolo }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar solicitação externa:', error)
    return NextResponse.json({ error: 'Erro interno ao criar solicitação externa.' }, { status: 500 })
  }
}
