// src/app/api/solicitacoes/[id]/finalizar-rh/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function generateProtocolo() {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')
  return `RQ${yy}${mm}${dd}-${rand}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = params.id

    const body = await req.json().catch(() => ({} as any))
    const {
      candidatoNome,
      candidatoDocumento,
      dataAdmissaoPrevista,
      salario,
      cargo,
    } = body

    // 1) Solicitação original (RH)
    const original = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      include: {
        tipo: true,
        costCenter: true,
        department: true,
      },
    })

    if (!original) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    // garantia: só RQ_063 entra aqui
    if (original.tipo?.nome !== 'RQ_063 - Solicitação de Pessoal') {
      return NextResponse.json(
        { error: 'Esta rota é apenas para RQ_063 - Solicitação de Pessoal.' },
        { status: 400 },
      )
    }

    // 2) Tipo de solicitação para o DP (ajuste o nome se for outro)
    const tipoAdmissao = await prisma.tipoSolicitacao.findFirst({
      where: { nome: 'Admissão - DP' }, // <-- se o seu nome for outro, troque aqui
    })

    if (!tipoAdmissao) {
      return NextResponse.json(
        { error: 'Tipo de solicitação de Admissão (DP) não configurado.' },
        { status: 400 },
      )
    }

    // 3) Departamento DP
    const departmentDp = await prisma.department.findFirst({
      where: {
        // ajuste se na sua base o code/name forem diferentes
        OR: [{ code: 'DP' }, { name: 'DEPARTAMENTO PESSOAL' }],
      },
    })

    if (!departmentDp) {
      return NextResponse.json(
        { error: 'Departamento Pessoal não encontrado (Department).' },
        { status: 400 },
      )
    }

    // 4) Centro de custo do DP
    const costCenterDp = await prisma.costCenter.findFirst({
      where: {
        // ajuste aqui também conforme sua base:
        OR: [
          { code: 'DP' },
          { description: 'DEPARTAMENTO PESSOAL' },
          { abbreviation: 'DP' },
        ],
      },
    })

    if (!costCenterDp) {
      return NextResponse.json(
        { error: 'Centro de custo do Departamento Pessoal não encontrado.' },
        { status: 400 },
      )
    }

    // 5) Concluir a solicitação original (RH)
    await prisma.solicitation.update({
      where: { id: original.id },
      data: {
        status: 'CONCLUIDA',
        dataFechamento: new Date(),
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: original.id,
        status: 'CONCLUIDA',
        message: `Finalizada pelo RH por ${me.fullName ?? me.id}. Encaminhada para o DP.`,
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: original.id,
        actorId: me.id,
        tipo: 'FINALIZACAO_RH',
      },
    })

    // 6) Criar o chamado FILHO para o DP
    const protocoloFilho = generateProtocolo()

    const nomeCandidatoFinal =
      candidatoNome ||
      (original.payload as any)?.campos?.nomeColaborador ||
      (original.payload as any)?.campos?.nomeCandidato ||
      'Novo colaborador'

    const documentoFinal =
      candidatoDocumento ||
      (original.payload as any)?.campos?.cpf ||
      (original.payload as any)?.campos?.documento ||
      undefined

    const dpSolicitation = await prisma.solicitation.create({
      data: {
        protocolo: protocoloFilho,
        tipoId: tipoAdmissao.id,

        // 🔴 AQUI ESTÁ O PULO DO GATO:
        //    Em vez de usar original.costCenterId, usamos o CC do DP
        costCenterId: costCenterDp.id,
        departmentId: departmentDp.id,

        // pode ser o mesmo solicitante da original
        solicitanteId: original.solicitanteId,

        parentId: original.id,

        requiresApproval: false,
        approvalStatus: 'NAO_PRECISA',

        status: 'ABERTA', // entra como "aguardando atendimento" do DP
        prioridade: original.prioridade,

        titulo: `Admissão - ${nomeCandidatoFinal}`,
        descricao: `Solicitação de admissão gerada automaticamente a partir da solicitação de pessoal ${original.protocolo}.`,

        payload: {
          origem: {
            solicitationId: original.id,
            protocolo: original.protocolo,
            tipo: original.tipo?.nome,
          },
          candidato: {
            nome: nomeCandidatoFinal,
            documento: documentoFinal,
            dataAdmissaoPrevista,
            salario,
            cargo,
          },
        },
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: dpSolicitation.id,
        status: 'ABERTA',
        message: `Chamado de admissão criado automaticamente a partir da solicitação de pessoal ${original.protocolo}.`,
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: dpSolicitation.id,
        actorId: me.id,
        tipo: 'CRIACAO_ADMISSAO_DP',
      },
    })

    return NextResponse.json(
      {
        message:
          'Solicitação finalizada no RH e chamada de admissão criada no DP.',
        dpSolicitationId: dpSolicitation.id,
      },
      { status: 201 },
    )
  } catch (e) {
    console.error('❌ POST /api/solicitacoes/[id]/finalizar-rh error:', e)
    return NextResponse.json(
      { error: 'Erro ao finalizar solicitação no RH e criar chamado no DP.' },
      { status: 500 },
    )
  }
}
