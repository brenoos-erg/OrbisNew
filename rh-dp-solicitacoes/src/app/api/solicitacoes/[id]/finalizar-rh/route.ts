// src/app/api/solicitacoes/[id]/finalizar-rh/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Ajuste esses valores conforme o seu cadastro:
 *
 * - NOME_TIPO_ADMISSAO: nome do TipoSolicitacao que representa "Admissão"
 * - DEPARTAMENTO_DP_CODE: código do Department que representa o DP
 */
const NOME_TIPO_ADMISSAO = 'RQ_064 - Admissão de Pessoal' // <- ajuste aqui
const DEPARTAMENTO_DP_CODE = 'DP' // <- ajuste aqui (Department.code)

/**
 * POST /api/solicitacoes/[id]/finalizar-rh
 *
 * Finaliza uma solicitação de pessoal (RQ_063) no RH
 * e cria automaticamente uma solicitação filha para o DP (admissão),
 * vinculada via parentId.
 *
 * Espera corpo:
 * {
 *   candidatoNome: string
 *   candidatoDocumento?: string
 *   dataAdmissaoPrevista?: string (ISO)
 *   salario?: string | number
 *   cargo?: string
 *   outrasInfos?: any
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = params.id

    const body = await req.json()
    const {
      candidatoNome,
      candidatoDocumento,
      dataAdmissaoPrevista,
      salario,
      cargo,
      outrasInfos,
    } = body

    // 1) Busca a solicitação original
    const original = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      include: {
        tipo: true,
        solicitante: true,
      },
    })

    if (!original) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    // (Opcional) Garante que só RQ_063 passe por esse fluxo
    // Se quiser ser rígido, descomente:
    //
    // if (original.tipo.nome !== 'RQ_063 - Solicitação de Pessoal') {
    //   return NextResponse.json(
    //     { error: 'Esta rota é exclusiva para RQ_063 - Solicitação de Pessoal.' },
    //     { status: 400 },
    //   )
    // }

    // 2) Atualiza solicitação original como concluída pelo RH
    const updatedOriginal = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        status: 'CONCLUIDA',
        dataFechamento: new Date(),
        payload: {
          ...(original.payload as any),
          candidato: {
            nome: candidatoNome,
            documento: candidatoDocumento,
            dataAdmissaoPrevista,
            salario,
            cargo,
            outrasInfos,
          },
          finalizadaPor: {
            id: me.id,
            nome: me.fullName,
            data: new Date().toISOString(),
          },
        },
      },
    })

    // Evento de conclusão no RH
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: updatedOriginal.id,
        actorId: me.id,
        tipo: 'CONCLUIDA_RH',
      },
    })

    // 3) Descobre o tipo "Admissão" (TipoSolicitacao) pelo nome
    const tipoAdmissao = await prisma.tipoSolicitacao.findUnique({
      where: { nome: NOME_TIPO_ADMISSAO },
    })

    if (!tipoAdmissao) {
      // Se não existir, não quebra o fluxo de finalização, só avisa
      return NextResponse.json(
        {
          original: updatedOriginal,
          warning:
            'Tipo de solicitação de Admissão não encontrado. Ajuste NOME_TIPO_ADMISSAO no backend.',
        },
        { status: 200 },
      )
    }

    // 4) Descobre o Department do DP pelo code
    const dpDepartment = await prisma.department.findFirst({
      where: { code: DEPARTAMENTO_DP_CODE },
    })

    const departmentIdForDp = dpDepartment?.id ?? original.departmentId

    // 5) Cria a solicitação filha para o DP (admissão)
    const protocoloFilho = generateProtocolo()

    const dpSolicitation = await prisma.solicitation.create({
      data: {
        protocolo: protocoloFilho,
        tipoId: tipoAdmissao.id,
        costCenterId: original.costCenterId,
        departmentId: departmentIdForDp,

        // pode ser o mesmo solicitante ou o usuário do RH que está finalizando
        solicitanteId: original.solicitanteId,

        // Admissão não precisa de aprovação (já veio aprovada do fluxo de pessoal)
        requiresApproval: false,
        approvalStatus: 'NAO_PRECISA',

        status: 'ABERTA',
        prioridade: original.prioridade,

        // Aqui já é algo equivalente a "vaga prevista / aprovada"
        vagaPrevista: true,

        titulo: `Admissão - ${candidatoNome ?? 'Novo colaborador'}`,
        descricao: `Solicitação gerada automaticamente a partir da solicitação de pessoal ${original.protocolo}.`,

        payload: {
          origem: {
            solicitationId: original.id,
            protocolo: original.protocolo,
            tipo: original.tipo.nome,
          },
          candidato: {
            nome: candidatoNome,
            documento: candidatoDocumento,
            dataAdmissaoPrevista,
            salario,
            cargo,
            outrasInfos,
          },
        },

        parentId: original.id,
      },
    })

    // Evento na filha (DP)
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: dpSolicitation.id,
        actorId: me.id,
        tipo: 'CRIADA_AUTOMATICAMENTE_DP',
      },
    })

    return NextResponse.json(
      {
        original: updatedOriginal,
        dpSolicitation,
      },
      { status: 200 },
    )
  } catch (e) {
    console.error('POST /api/solicitacoes/[id]/finalizar-rh error', e)
    return NextResponse.json(
      { error: 'Erro ao finalizar a solicitação pelo RH.' },
      { status: 500 },
    )
  }
}

/**
 * Mesmo gerador de protocolo usado no /api/solicitacoes
 * (pode extrair para um util se quiser reutilizar).
 */
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
