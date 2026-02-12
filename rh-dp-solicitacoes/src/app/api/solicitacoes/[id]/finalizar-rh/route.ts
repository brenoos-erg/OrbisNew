export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { isSolicitacaoDesligamento, isSolicitacaoEquipamento } from '@/lib/solicitationTypes'

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
    duracaoMeses,
      valorMensal,
    } = body as {
      candidatoNome?: string
      candidatoDocumento?: string
      dataAdmissaoPrevista?: string
      salario?: string
      cargo?: string
      outrasInfos?: Record<string, any>
      duracaoMeses?: string | number
      valorMensal?: string | number
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
    const pendingTermAssignments = await prisma.documentAssignment.count({
      where: {
        document: {
          solicitationId: solicitation.id,
          type: 'TERMO_RESPONSABILIDADE',
        },
        status: { in: ['PENDENTE', 'AGUARDANDO_ASSINATURA'] },
      },
    })

    if (pendingTermAssignments > 0) {
      return NextResponse.json(
        { error: 'Aguardando assinatura do termo de responsabilidade.' },
        { status: 409 },
      )
    }
    const signedTermAssignments = await prisma.documentAssignment.count({
      where: {
        document: {
          solicitationId: solicitation.id,
          type: 'TERMO_RESPONSABILIDADE',
        },
        status: 'ASSINADO',
      },
    })


    const isSolicitacaoPessoal =
      solicitation.tipo?.nome === 'RQ_063 - Solicitação de Pessoal'
    const isSolicitacaoIncentivo =
      solicitation.tipo?.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
    const isDesligamento = isSolicitacaoDesligamento(solicitation.tipo)
    const isAdmissaoGerada =
      solicitation.tipo?.nome === 'Solicitação de Admissão'
    const isSolicitacaoEquipamentoTi = isSolicitacaoEquipamento(solicitation.tipo)

    if (isSolicitacaoEquipamentoTi && signedTermAssignments === 0) {
      return NextResponse.json(
        { error: 'Só é possível finalizar após o termo de responsabilidade estar assinado.' },
        { status: 409 },
      )
    }
    const isDpDestino = Boolean(
      solicitation.costCenter?.externalCode === '590' ||
        solicitation.costCenter?.description?.toLowerCase().includes('pessoal') ||
        solicitation.department?.code === '08',
    )

    const payloadOrigem = (solicitation.payload ?? {}) as any
    const camposOrigem = payloadOrigem.campos ?? {}
    const solicitanteOrigem = payloadOrigem.solicitante ?? {}
    const vemDeRh = Boolean(payloadOrigem?.origem?.rhSolicitationId)

    if (
      !isSolicitacaoPessoal &&
      !isSolicitacaoIncentivo &&
      !isAdmissaoGerada &&
      !isDesligamento &&
      !isSolicitacaoEquipamentoTi
    ) {
      return NextResponse.json(
        {
          error:
            'Esta rota só pode ser usada para RQ_063, RQ_091, RQ_247, solicitações de equipamento ou solicitações de admissão oriundas do RH.',
        },
        { status: 400 },
      )
    }
    
    const nomeFinalIncentivo =
      (outrasInfos?.nomeColaborador as string | undefined)?.trim() ??
      (camposOrigem.nomeColaborador as string | undefined)?.trim() ??
      ''

    const duracaoMesesFinal =
      duracaoMeses ?? outrasInfos?.duracaoMeses ?? camposOrigem.duracaoMeses
    const valorMensalFinal =
      valorMensal ?? outrasInfos?.valorMensal ?? camposOrigem.valorMensal

    const duracaoNumber =
      typeof duracaoMesesFinal === 'number'
        ? duracaoMesesFinal
        : Number.parseFloat((duracaoMesesFinal ?? '').toString().replace(',', '.'))
    const valorMensalNumber =
      typeof valorMensalFinal === 'number'
        ? valorMensalFinal
        : Number.parseFloat((valorMensalFinal ?? '').toString().replace(',', '.'))
    const valorTotalNumber =
      Number.isFinite(duracaoNumber) && Number.isFinite(valorMensalNumber)
        ? duracaoNumber * valorMensalNumber
        : null

    if (isSolicitacaoIncentivo && !vemDeRh) {
      if (!nomeFinalIncentivo) {
        return NextResponse.json(
          { error: 'Informe o nome do usuário antes de enviar ao DP.' },
          { status: 400 },
        )
      }

      if (!Number.isFinite(duracaoNumber) || duracaoNumber <= 0) {
        return NextResponse.json(
          { error: 'Informe a duração do curso (em meses) para prosseguir.' },
          { status: 400 },
        )
      }

      if (!Number.isFinite(valorMensalNumber) || valorMensalNumber <= 0) {
        return NextResponse.json(
          { error: 'Informe o valor mensal do curso para prosseguir.' },
          { status: 400 },
        )
      }
    }
    if (isSolicitacaoEquipamentoTi) {
      const agora = new Date()
      const updated = await prisma.solicitation.update({
        where: { id: solicitation.id },
        data: {
          status: 'CONCLUIDA',
          dataFechamento: agora,
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'CONCLUIDA',
          message: 'Solicitação de equipamento concluída após assinatura do termo.',
        },
      })

      await prisma.event.create({
        data: {
          id: randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'FINALIZADA_TI',
        },
      })

      return NextResponse.json({ solicitation: updated }, { status: 200 })
    }
    if (isAdmissaoGerada && vemDeRh) {
      const agora = new Date()
      const updated = await prisma.solicitation.update({
        where: { id: solicitation.id },
        data: {
          status: 'CONCLUIDA',
          dataFechamento: agora,
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'CONCLUIDA',
          message: `Solicitação finalizada pelo DP em ${agora.toLocaleDateString('pt-BR')}.`,
        },
      })

      await prisma.event.create({
        data: {
          id: randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'FINALIZADA_DP',
        },
      })

      return NextResponse.json({ dp: updated }, { status: 200 })
    }
     if (isDesligamento && (vemDeRh || isDpDestino)) {
      const agora = new Date()
      const updated = await prisma.solicitation.update({
        where: { id: solicitation.id },
        data: {
          status: 'CONCLUIDA',
          dataFechamento: agora,
          payload: {
            ...payloadOrigem,
            campos: {
              ...camposOrigem,
              ...(outrasInfos ?? {}),
            },
          },
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'CONCLUIDA',
          message: `Solicitação finalizada pelo DP em ${agora.toLocaleDateString('pt-BR')}.`,
        },
      })

      await prisma.event.create({
        data: {
          id: randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'FINALIZADA_DP',
        },
      })

      return NextResponse.json({ dp: updated }, { status: 200 })
    }


    if (isSolicitacaoIncentivo && vemDeRh) {
      const agora = new Date()
      const updated = await prisma.solicitation.update({
        where: { id: solicitation.id },
        data: {
          status: 'CONCLUIDA',
          dataFechamento: agora,
          payload: {
            ...payloadOrigem,
            campos: {
              ...camposOrigem,
              ...(outrasInfos ?? {}),
              nomeColaborador: nomeFinalIncentivo || camposOrigem.nomeColaborador,
              duracaoMeses: Number.isFinite(duracaoNumber)
                ? duracaoNumber
                : camposOrigem.duracaoMeses,
              valorMensal: Number.isFinite(valorMensalNumber)
                ? valorMensalNumber
                : camposOrigem.valorMensal,
              valorTotal: Number.isFinite(valorTotalNumber)
                ? valorTotalNumber
                : camposOrigem.valorTotal,
            },
          },
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'CONCLUIDA',
          message: `Solicitação finalizada pelo DP em ${agora.toLocaleDateString('pt-BR')}.`,
        },
      })

      await prisma.event.create({
        data: {
          id: randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'FINALIZADA_DP',
        },
      })

      return NextResponse.json({ dp: updated }, { status: 200 })
    }

/*
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
          { name: { contains: 'Pessoal' } },
        ],
      },
    })
      */

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
              ...(candidatoNome
                ? { candidatoNome }
                : camposOrigem.candidatoNome
                  ? { candidatoNome: camposOrigem.candidatoNome }
                  : {}),
              ...(candidatoDocumento
                ? { candidatoDocumento }
                : camposOrigem.candidatoDocumento
                  ? { candidatoDocumento: camposOrigem.candidatoDocumento }
                  : {}),
              ...(dataAdmissaoPrevista
                ? { dataAdmissaoPrevista }
                : camposOrigem.dataAdmissaoPrevista
                  ? { dataAdmissaoPrevista: camposOrigem.dataAdmissaoPrevista }
                  : {}),
              ...(salario
                ? { salario }
                : camposOrigem.salario
                  ? { salario: camposOrigem.salario }
                  : {}),
              ...(cargo
                ? { cargoFinal: cargo }
                : camposOrigem.cargoFinal
                  ? { cargoFinal: camposOrigem.cargoFinal }
                  : {}),
              ...(outrasInfos ?? {}),
              ...(isSolicitacaoIncentivo
                ? {
                    nomeColaborador: nomeFinalIncentivo,
                    duracaoMeses: Number.isFinite(duracaoNumber)
                      ? duracaoNumber
                      : undefined,
                    valorMensal: Number.isFinite(valorMensalNumber)
                      ? valorMensalNumber
                      : undefined,
                    valorTotal: Number.isFinite(valorTotalNumber)
                      ? valorTotalNumber
                      : undefined,
                  }
                : {}),
            },
          },
        },
      })

      await tx.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'CONCLUIDA',
          message: isSolicitacaoPessoal
            ? `Finalizada no RH por ${me.fullName ?? me.id} e encaminhada para o DP.`
           : isSolicitacaoIncentivo
              ? `Finalizada no RH por ${me.fullName ?? me.id} e enviada ao DP.`
              : isDesligamento
                ? `Finalizada no RH por ${me.fullName ?? me.id} e enviada ao DP.`
              : `Finalizada no RH por ${me.fullName ?? me.id}.`,
        },
      })

      await tx.event.create({
        data: {
          id: randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'FINALIZADA_RH',
        },
      })

      let dpSolicitation: any = null

      if (isSolicitacaoPessoal) {
        // Tipo de solicitação do DP
        const tipoAdmissao = await tx.tipoSolicitacao.findFirst({
          where: { nome: 'Solicitação de Admissão' },
        })

        if (!tipoAdmissao) {
          throw new Error('Tipo "Solicitação de Admissão" não cadastrado.')
        }

        // Centro de custo do DP (externalCode = 590)
        const ccDp = await tx.costCenter.findFirst({
          where: { externalCode: '590' },
        })

        if (!ccDp) {
          throw new Error(
            'Centro de custo do DP (externalCode = 590) não encontrado.',
          )
        }

        // Departamento do DP (ajuste o critério se for diferente)
        const deptDp = await tx.department.findFirst({
          where: {
            OR: [
              { code: 'DP' },
              { name: { contains: 'Pessoal' } },
            ],
          },
        })

        // 4.2) Cria a nova solicitação para o DP – Solicitação de Admissão
        dpSolicitation = await tx.solicitation.create({
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
            approvalStatus: 'APROVADO',
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
             status: 'AGUARDANDO_ATENDIMENTO',
            message:
              `Solicitação de admissão criada automaticamente a partir da ${solicitation.protocolo} e aguardando atendimento do DP.`,
          },
        })

     await tx.event.create({
          data: {
            id: randomUUID(),
            solicitationId: dpSolicitation.id,
            actorId: me.id,
            tipo: 'CRIACAO_AUTOMATICA_ADMISSAO',
          },

        })
        // 4.3) Replica os anexos enviados no RH para a solicitação do DP
        if (solicitation.anexos && solicitation.anexos.length > 0) {
          await tx.attachment.createMany({
            data: solicitation.anexos.map((a) => ({
                 id: randomUUID(),
              solicitationId: dpSolicitation.id,
              filename: a.filename,
              url: a.url,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt,
            })),
          })
        }
      }

      if (isSolicitacaoIncentivo) {
        const tipoIncentivo = await tx.tipoSolicitacao.findFirst({
          where: { nome: 'RQ_091 - Solicitação de Incentivo à Educação' },
        })

        if (!tipoIncentivo) {
          throw new Error(
            'Tipo "RQ_091 - Solicitação de Incentivo à Educação" não cadastrado.',
          )
        }

        const ccDp = await tx.costCenter.findFirst({
          where: { externalCode: '590' },
        })

        if (!ccDp) {
          throw new Error(
            'Centro de custo do DP (externalCode = 590) não encontrado.',
          )
        }

        const deptDp = await tx.department.findFirst({
          where: {
            OR: [
              { code: 'DP' },
              { name: { contains: 'Pessoal' } },
            ],
          },
        })

        dpSolicitation = await tx.solicitation.create({
          data: {
            protocolo: generateProtocolo(),
            tipoId: tipoIncentivo.id,
            costCenterId: ccDp.id,
            departmentId: deptDp?.id ?? solicitation.departmentId,
            solicitanteId: solicitation.solicitanteId,
            parentId: solicitation.id,
            titulo: 'RQ_091 - Solicitação de Incentivo à Educação',
            descricao: ` ${solicitation.protocolo}.`,
            requiresApproval: false,
            approvalStatus: 'APROVADO',
            status: 'ABERTA',
            payload: {
              origem: {
                rhSolicitationId: solicitation.id,
                rhProtocolo: solicitation.protocolo,
              },
              campos: {
                ...camposOrigem,
                ...(candidatoNome
                  ? { candidatoNome }
                  : camposOrigem.candidatoNome
                    ? { candidatoNome: camposOrigem.candidatoNome }
                    : {}),
                ...(candidatoDocumento
                  ? { candidatoDocumento }
                  : camposOrigem.candidatoDocumento
                    ? { candidatoDocumento: camposOrigem.candidatoDocumento }
                    : {}),
                ...(dataAdmissaoPrevista
                  ? { dataAdmissaoPrevista }
                  : camposOrigem.dataAdmissaoPrevista
                    ? { dataAdmissaoPrevista: camposOrigem.dataAdmissaoPrevista }
                    : {}),
                ...(salario
                  ? { salario }
                  : camposOrigem.salario
                    ? { salario: camposOrigem.salario }
                    : {}),
                ...(cargo
                  ? { cargoFinal: cargo }
                  : camposOrigem.cargoFinal
                    ? { cargoFinal: camposOrigem.cargoFinal }
                    : {}),
                ...(outrasInfos ?? {}),
                nomeColaborador: nomeFinalIncentivo,
                duracaoMeses: Number.isFinite(duracaoNumber)
                  ? duracaoNumber
                  : null,
                valorMensal: Number.isFinite(valorMensalNumber)
                  ? valorMensalNumber
                  : null,
                valorTotal: Number.isFinite(valorTotalNumber)
                  ? valorTotalNumber
                  : null,
              },
              solicitante: solicitanteOrigem,
            },
          },
        })

        await tx.solicitationTimeline.create({
          data: {
            solicitationId: dpSolicitation.id,
            status: 'AGUARDANDO_ATENDIMENTO',
            message:
              `Solicitação encaminhada para o DP a partir da ${solicitation.protocolo} e aguardando atendimento.`,
          },
        })

        await tx.event.create({
          data: {
            id: randomUUID(),
            solicitationId: dpSolicitation.id,
            actorId: me.id,
            tipo: 'CRIACAO_AUTOMATICA_INCENTIVO',
          },
        })

        if (solicitation.anexos && solicitation.anexos.length > 0) {
          await tx.attachment.createMany({
            data: solicitation.anexos.map((a) => ({
              id: randomUUID(),
              solicitationId: dpSolicitation.id,
              filename: a.filename,
              url: a.url,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt,
            })),
          })
        }
      }
       if (isDesligamento) {
        const ccDp = await tx.costCenter.findFirst({
          where: { externalCode: '590' },
        })

        if (!ccDp) {
          throw new Error(
            'Centro de custo do DP (externalCode = 590) não encontrado.',
          )
        }
        const deptDp = await tx.department.findUnique({
          where: { code: '08' },
        })

        dpSolicitation = await tx.solicitation.create({
          data: {
            protocolo: generateProtocolo(),
            tipoId: solicitation.tipoId,
            costCenterId: ccDp.id,
            departmentId: deptDp?.id ?? solicitation.departmentId,
            solicitanteId: solicitation.solicitanteId,
            parentId: solicitation.id,
            titulo: solicitation.titulo,
            descricao: `Solicitação encaminhada pelo RH para o DP a partir da ${solicitation.protocolo}.`,
            requiresApproval: false,
            approvalStatus: 'APROVADO',
            status: 'ABERTA',
            payload: {
              origem: {
                rhSolicitationId: solicitation.id,
                rhProtocolo: solicitation.protocolo,
              },
              campos: {
                ...camposOrigem,
                ...(outrasInfos ?? {}),
              },
              solicitante: solicitanteOrigem,
            },
          },
        })

        await tx.solicitationTimeline.create({
          data: {
            solicitationId: dpSolicitation.id,
            status: 'AGUARDANDO_ATENDIMENTO',
            message:
              `Solicitação de desligamento encaminhada para o DP a partir da ${solicitation.protocolo} e aguardando atendimento.`,
          },
        })

        await tx.event.create({
          data: {
            id: randomUUID(),
            solicitationId: dpSolicitation.id,
            actorId: me.id,
            tipo: 'CRIACAO_AUTOMATICA_DESLIGAMENTO',
          },
        })

        if (solicitation.anexos && solicitation.anexos.length > 0) {
          await tx.attachment.createMany({
            data: solicitation.anexos.map((a) => ({
              id: randomUUID(),
              solicitationId: dpSolicitation.id,
              filename: a.filename,
              url: a.url,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt,
            })),
          })
        }
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
      { error: 'Erro ao finalizar solicitação no RH.' },
      { status: 500 },
    )
  }
}

