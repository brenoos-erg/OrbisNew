import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Reaproveita o mesmo formato de protocolo da rota principal
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
    const { id } = params

    const body = await req.json().catch(() => ({} as any))

    const {
      candidatoNome,
      candidatoDocumento,
      dataAdmissaoPrevista,
      salario,
      cargo,
      outrasInfos,
    } = body as {
      candidatoNome?: string
      candidatoDocumento?: string
      dataAdmissaoPrevista?: string
      salario?: string
      cargo?: string
      outrasInfos?: Record<string, any>
    }

    // 1) Busca a solicitação original (RH)
    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: {
        tipo: true,
        costCenter: true,
        department: true,
        anexos: true,
      },
    })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (solicitation.tipo?.nome !== 'RQ_063 - Solicitação de Pessoal') {
      return NextResponse.json(
        { error: 'Esta rota só pode ser usada para RQ_063 - Solicitação de Pessoal.' },
        { status: 400 },
      )
    }

    const payloadOrigem = (solicitation.payload ?? {}) as any
    const camposOrigem = payloadOrigem.campos ?? {}
    const solicitanteOrigem = payloadOrigem.solicitante ?? {}

    // 2) Tipo de solicitação do DP
    const tipoAdmissao = await prisma.tipoSolicitacao.findFirst({
      where: { nome: 'Solicitação de Admissão' },
    })

    if (!tipoAdmissao) {
      return NextResponse.json(
        { error: 'Tipo "Solicitação de Admissão" não cadastrado.' },
        { status: 400 },
      )
    }

    // 3) Centro de custo do DP (externalCode = 590)
    const ccDp = await prisma.costCenter.findFirst({
      where: { externalCode: '590' },
    })

    if (!ccDp) {
      return NextResponse.json(
        { error: 'Centro de custo do DP (externalCode = 590) não encontrado.' },
        { status: 400 },
      )
    }

    // 4) Departamento do DP (ajuste o critério se for diferente)
    const deptDp = await prisma.department.findFirst({
      where: {
        OR: [
          { code: 'DP' },
          { name: { contains: 'Pessoal', mode: 'insensitive' } },
        ],
      },
    })

    const agora = new Date()

    const result = await prisma.$transaction(async (tx) => {
      // 4.1) Atualiza a solicitação do RH como CONCLUÍDA
      const updatedRh = await tx.solicitation.update({
        where: { id: solicitation.id },
        data: {
          status: 'CONCLUIDA',
          dataFechamento: agora,
          payload: {
            ...payloadOrigem,
            campos: {
              ...camposOrigem,
              candidatoNome: candidatoNome ?? camposOrigem.candidatoNome,
              candidatoDocumento:
                candidatoDocumento ?? camposOrigem.candidatoDocumento,
              dataAdmissaoPrevista:
                dataAdmissaoPrevista ?? camposOrigem.dataAdmissaoPrevista,
              salario: salario ?? camposOrigem.salario,
              cargoFinal: cargo ?? camposOrigem.cargoFinal,
              ...(outrasInfos ?? {}),
            },
          },
        },
      })

      await tx.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'CONCLUIDA',
          message: `Finalizada no RH por ${me.fullName ?? me.id} e encaminhada para o DP.`,
        },
      })

      await tx.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'FINALIZADA_RH',
        },
      })

      // 4.2) Cria a nova solicitação para o DP – Solicitação de Admissão
      const dpSolicitation = await tx.solicitation.create({
        data: {
          protocolo: generateProtocolo(),
          tipoId: tipoAdmissao.id,
          costCenterId: ccDp.id,
          departmentId: deptDp?.id ?? solicitation.departmentId,
          solicitanteId: solicitation.solicitanteId, // ou me.id, se preferir
          parentId: solicitation.id, // vínculo pai/filho
          titulo: 'Solicitação de Admissão',
          descricao: `Solicitação de admissão gerada automaticamente a partir da ${solicitation.protocolo}.`,
          requiresApproval: false,
          approvalStatus: 'NAO_PRECISA',
          status: 'ABERTA',
          payload: {
            origem: {
              rhSolicitationId: solicitation.id,
              rhProtocolo: solicitation.protocolo,
            },
            campos: {
              // campos reaproveitados da RQ_063:
              cargo: cargo ?? camposOrigem.cargo,
              setorProjeto:
                camposOrigem.setorProjeto ?? camposOrigem.setorOuProjeto,
              localTrabalho: camposOrigem.localTrabalho,
              horarioTrabalho: camposOrigem.horarioTrabalho,
              centroCusto: camposOrigem.centroCusto,
              chefiaImediata: camposOrigem.chefiaImediata,
              motivoVaga: camposOrigem.motivoDaVaga,
              tipoContratacao: camposOrigem.contratacao,
              beneficios: camposOrigem.beneficios,
              cbo: camposOrigem.cbo,
              matriz: camposOrigem.matriz,
              filial: camposOrigem.filial,
              observacao:
                outrasInfos?.observacao ?? camposOrigem.observacao,

              // dados do contratado (vindos do formulário de finalização):
              nomeProfissional:
                candidatoNome ??
                camposOrigem.nomeProfissional ??
                camposOrigem.nomeCandidato,
              documento:
                candidatoDocumento ?? camposOrigem.cpf ?? camposOrigem.documento,
              salario: salario ?? camposOrigem.salario,
              dataAdmissao:
                dataAdmissaoPrevista ?? camposOrigem.dataAdmissaoPrevista,
            },
            // mantém os dados do solicitante original (quem pediu a vaga)
            solicitante: solicitanteOrigem,
          },
        },
      })

      await tx.solicitationTimeline.create({
        data: {
          solicitationId: dpSolicitation.id,
          status: 'ABERTA',
          message: `Solicitação de admissão criada automaticamente a partir da ${solicitation.protocolo}.`,
        },
      })

      await tx.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId: dpSolicitation.id,
          actorId: me.id,
          tipo: 'CRIACAO_AUTOMATICA_ADMISSAO',
        },
      })
       // 4.3) Replica os anexos enviados no RH para a solicitação do DP
      if (solicitation.anexos && solicitation.anexos.length > 0) {
        await tx.attachment.createMany({
          data: solicitation.anexos.map((a) => ({
            id: crypto.randomUUID(),
            solicitationId: dpSolicitation.id,
            filename: a.filename,
            url: a.url,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            createdAt: a.createdAt,
          })),
        })
      }

      return {
        rh: updatedRh,
        dp: dpSolicitation,
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    console.error('POST /api/solicitacoes/[id]/finalizar-rh error', err)
    return NextResponse.json(
      { error: 'Erro ao finalizar solicitação no RH / criar admissão.' },
      { status: 500 },
    )
  }
}
