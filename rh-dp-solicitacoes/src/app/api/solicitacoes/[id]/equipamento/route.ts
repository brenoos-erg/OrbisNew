export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'
import { isSolicitacaoEquipamento } from '@/lib/solicitationTypes'
import { findLevel3SolicitacoesApprover } from '@/lib/solicitationApprovers'
import { PdfGenerationError, generatePdfFromHtml } from '@/lib/pdf/generatePdfFromHtml'
import { uploadGeneratedFile } from '@/lib/storage/uploadGeneratedFile'
import { createEnvelopeFromPdfBuffer } from '@/lib/signature/providers/docusign/envelopes'
import { createRecipientView } from '@/lib/signature/providers/docusign/recipientView'

const DEFAULT_CLAUSES = [
  'Utilizar o equipamento exclusivamente para fins profissionais autorizados pela empresa.',
  'Preservar a integridade física e lógica do equipamento, comunicando imediatamente qualquer incidente.',
  'Não instalar softwares sem autorização prévia da área de TI.',
  'Devolver o equipamento quando solicitado ou no desligamento, com todos os acessórios recebidos.',
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = (await params).id
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'ALOCAR' | 'ALOCAR_E_GERAR_TERMO' | 'SEM_ESTOQUE'
      equipmentId?: string
      title?: string
      pdfUrl?: string
      signingProvider?: string
      signingUrl?: string
    }

    const action = body.action
    if (!action || !['ALOCAR', 'ALOCAR_E_GERAR_TERMO', 'SEM_ESTOQUE'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      include: {
        tipo: true,
        costCenter: true,
        solicitante: true,
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (!isSolicitacaoEquipamento(solicitation.tipo)) {
      return NextResponse.json(
        { error: 'Esta rota é exclusiva para solicitações de equipamento.' },
        { status: 400 },
      )
    }

    if (action === 'SEM_ESTOQUE') {
      const approver = await findLevel3SolicitacoesApprover()
      const approverId = approver?.id ?? null

      const updated = await prisma.solicitation.update({
        where: { id: solicitation.id },
        data: {
          requiresApproval: true,
          approvalStatus: 'PENDENTE',
          approverId,
          status: 'AGUARDANDO_APROVACAO',
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'AGUARDANDO_APROVACAO',
          message:
            'Solicitação de equipamento sem estoque disponível. Encaminhada para aprovação.',
        },
      })

      await prisma.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'AGUARDANDO_APROVACAO_GESTOR',
        },
      })

      return NextResponse.json(updated)
    }

    if (!body.equipmentId) {
      return NextResponse.json({ error: 'equipmentId é obrigatório para alocação.' }, { status: 400 })
    }

    if (action === 'ALOCAR' && !body.pdfUrl) {
      return NextResponse.json(
        { error: 'pdfUrl é obrigatório para a ação legada ALOCAR.' },
        { status: 400 },
      )
    }

    const equipment = await prisma.tiEquipment.findUnique({
      where: { id: body.equipmentId },
      select: { id: true, status: true, name: true, patrimonio: true, category: true, serialNumber: true },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipamento não encontrado.' }, { status: 404 })
    }

    if (equipment.status !== 'IN_STOCK') {
      return NextResponse.json(
        { error: 'Somente equipamentos com status IN_STOCK podem ser alocados.' },
        { status: 409 },
      )
    }
    let generatedPdfUrl = body.pdfUrl?.trim() || ''
    let generatedPdfBuffer: Buffer | undefined

    if (action === 'ALOCAR_E_GERAR_TERMO') {
      const pdfBuffer = await generatePdfFromHtml({
        protocolo: solicitation.protocolo,
        dataHora: new Date().toLocaleString('pt-BR'),
        nomeSolicitante: solicitation.solicitante.fullName,
        email: solicitation.solicitante.email,
        login: solicitation.solicitante.login || '-',
        telefone: solicitation.solicitante.phone || '-',
        centroCusto: solicitation.costCenter?.description || '-',
        equipamentoNome: equipment.name,
        equipamentoModelo: equipment.serialNumber || equipment.category || '-',
        patrimonio: equipment.patrimonio,
        regras: DEFAULT_CLAUSES,
        aceite: 'Declaro que li, compreendi e concordo integralmente com as regras acima.',
      })

      const fileName = `termo-responsabilidade-${solicitation.protocolo}-${equipment.patrimonio}-${Date.now()}.pdf`
      const uploaded = await uploadGeneratedFile({ fileName, buffer: pdfBuffer, contentType: 'application/pdf' })
      generatedPdfUrl = uploaded.url
      generatedPdfBuffer = pdfBuffer
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.tiEquipment.update({
        where: { id: equipment.id },
        data: {
          status: 'ASSIGNED',
          userId: solicitation.solicitanteId,
        },
      })

      const document = await tx.document.create({
        data: {
          solicitationId: solicitation.id,
          type: 'TERMO_RESPONSABILIDADE',
          title:
            body.title?.trim() ||
            `Termo de responsabilidade - ${solicitation.protocolo} - ${equipment.name}`,
          pdfUrl: generatedPdfUrl,
          createdById: me.id,
        },
      })

      const assignment = await tx.documentAssignment.create({
        data: {
          userId: solicitation.solicitanteId,
          documentId: document.id,
          status: body.signingUrl || action === 'ALOCAR_E_GERAR_TERMO' ? 'AGUARDANDO_ASSINATURA' : 'PENDENTE',
          signingProvider: action === 'ALOCAR_E_GERAR_TERMO' ? 'DOCUSIGN' : body.signingProvider || null,
          signingUrl: body.signingUrl ? String(body.signingUrl) : null,
        },
      })

      const updated = await tx.solicitation.update({
        where: { id: solicitation.id },
        data: {
          assumidaPorId: me.id,
          assumidaEm: new Date(),
          requiresApproval: false,
          approvalStatus: 'APROVADO',
          approverId: null,
          status: 'AGUARDANDO_TERMO',
        },
      })

      await tx.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'AGUARDANDO_TERMO',
          message: `Equipamento ${equipment.patrimonio} alocado e termo enviado para assinatura.`,
        },
      })

      await tx.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'TERMO_GERADO',
        },
      })

      return { updated, document, assignment }
    })

    if (action === 'ALOCAR_E_GERAR_TERMO') {
      const clientUserId = result.assignment.id
      const appBaseUrl =
        process.env.APP_BASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        req.nextUrl.origin
      const returnUrl = `${appBaseUrl}/dashboard/meus-documentos/return?assignmentId=${result.assignment.id}`
      const { envelopeId } = await createEnvelopeFromPdfBuffer({
        pdfBuffer: generatedPdfBuffer!,
        filename: result.document.title,
        emailSubject: `Assinatura de termo - ${solicitation.protocolo}`,
        signerName: solicitation.solicitante.fullName,
        signerEmail: solicitation.solicitante.email,
        clientUserId,
      })

      const recipient = await createRecipientView({
        envelopeId,
        signerName: solicitation.solicitante.fullName,
        signerEmail: solicitation.solicitante.email,
        clientUserId,
        returnUrl,
      })

      const assignment = await prisma.documentAssignment.update({
        where: { id: result.assignment.id },
        data: {
          signingProvider: 'DOCUSIGN',
          signingUrl: recipient.url,
          signingExternalId: envelopeId,
          signingReturnUrl: returnUrl,
        },
      })

      return NextResponse.json({
        assignmentId: assignment.id,
        documentUrl: result.document.pdfUrl,
        signingUrl: recipient.url,
        status: assignment.status,
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error(
      'Erro no fluxo de equipamento da solicitação',
      error?.stack || error,
    )

    const isProduction = process.env.NODE_ENV === 'production'

    if (error instanceof PdfGenerationError) {
      return NextResponse.json(
        {
          error: error.message,
          detail: !isProduction ? error.detail || error.message : undefined,
        },
        { status: error.statusCode },
      )
    }

    const detail =
      error?.response?.body?.message ||
      error?.response?.text ||
      error?.message ||
      null

    return NextResponse.json(
      {
        error: 'Erro ao processar solicitação de equipamento.',
        detail: !isProduction ? detail : undefined,
      },
      { status: 500 },
    )
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireActiveUser()
    const solicitationId = (await params).id
    const pageParam = Number.parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
    const pageSizeParam = Number.parseInt(req.nextUrl.searchParams.get('pageSize') ?? '50', 10)
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const pageSize = Number.isFinite(pageSizeParam)
      ? Math.min(100, Math.max(5, pageSizeParam))
      : 50

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      include: { tipo: true },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (!isSolicitacaoEquipamento(solicitation.tipo)) {
      return NextResponse.json(
        { error: 'Esta rota é exclusiva para solicitações de equipamento.' },
        { status: 400 },
      )
    }

    const where = { status: 'IN_STOCK' as const }
    const [items, total] = await Promise.all([
      prisma.tiEquipment.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { patrimonio: 'asc' }],
        select: {
          id: true,
          name: true,
          patrimonio: true,
          status: true,
          category: true,
          serialNumber: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tiEquipment.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (error) {
    console.error('Erro ao carregar equipamentos em estoque para solicitação', error)
    return NextResponse.json(
      { error: 'Erro ao carregar equipamentos em estoque.', detail: devErrorDetail(error) },
      { status: 500 },
    )
  }
}