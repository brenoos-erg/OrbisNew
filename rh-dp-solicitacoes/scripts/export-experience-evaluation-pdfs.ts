const { mkdir, writeFile } = require('node:fs/promises')
const path = require('node:path')
const { prisma } = require('../src/lib/prisma')
const {
  hasExperienceEvaluationPrintableData,
  isExperienceEvaluationTipoLike,
  normalizeExperienceEvaluationPayload,
} = require('../src/lib/experienceEvaluation')
const {
  buildExperienceEvaluationPdfFilename,
  generateExperienceEvaluationPdfBuffer,
  URGENT_EXPERIENCE_EVALUATION_PROTOCOLS,
} = require('../src/lib/pdf/experienceEvaluationPdf')

const outputDir = path.resolve(process.cwd(), 'exports', 'avaliacoes-experiencia')

async function exportProtocol(protocolo: string) {
  const solicitation = await prisma.solicitation.findUnique({
    where: { protocolo },
    include: {
      tipo: { select: { id: true, codigo: true, nome: true } },
      solicitante: { select: { fullName: true } },
    },
  })

  if (!solicitation) {
    return { protocolo, encontrado: false, status: '-', gerado: false, erro: 'não encontrado', caminho: '-' }
  }

  if (
    !isExperienceEvaluationTipoLike({
      id: solicitation.tipo?.id ?? solicitation.tipoId,
      codigo: solicitation.tipo?.codigo,
      nome: solicitation.tipo?.nome,
    })
  ) {
    return {
      protocolo,
      encontrado: true,
      status: solicitation.status,
      gerado: false,
      erro: 'não é RQ_RH_103 / Avaliação do período de experiência',
      caminho: '-',
    }
  }

  if (solicitation.status === 'CANCELADA') {
    return {
      protocolo,
      encontrado: true,
      status: solicitation.status,
      gerado: false,
      erro: 'Esta avaliação foi cancelada e não pode ser impressa.',
      caminho: '-',
    }
  }

  if (!hasExperienceEvaluationPrintableData(solicitation.payload)) {
    return {
      protocolo,
      encontrado: true,
      status: solicitation.status,
      gerado: false,
      erro: 'A avaliação ainda não possui dados suficientes para impressão.',
      caminho: '-',
    }
  }

  const evaluation = normalizeExperienceEvaluationPayload(solicitation.payload)
  const pdf = await generateExperienceEvaluationPdfBuffer({
    protocolo: solicitation.protocolo,
    solicitanteNome: solicitation.solicitante.fullName,
    tipoNome: solicitation.tipo?.nome ?? 'Avaliação do Período de Experiência',
    evaluation,
  })
  await mkdir(outputDir, { recursive: true })
  const caminho = path.join(outputDir, buildExperienceEvaluationPdfFilename(solicitation.protocolo))
  await writeFile(caminho, pdf)

  return {
    protocolo,
    encontrado: true,
    status: solicitation.status,
    gerado: true,
    erro: '-',
    caminho,
  }
}

async function main() {
  const protocolos = process.argv.slice(2).map((item: string) => item.trim()).filter(Boolean)
  const targetProtocols = protocolos.length > 0 ? protocolos : [...URGENT_EXPERIENCE_EVALUATION_PROTOCOLS]

  console.log('protocolo\tencontrado\tstatus\tgerado\tcaminho\terro')
  for (const protocolo of targetProtocols) {
    try {
      const result = await exportProtocol(protocolo)
      console.log(
        `${result.protocolo}\t${result.encontrado ? 'sim' : 'não'}\t${result.status}\t${result.gerado ? 'sim' : 'não'}\t${result.caminho}\t${result.erro}`,
      )
    } catch (error: any) {
      console.log(`${protocolo}\t-\t-\tnão\t-\t${error?.message ?? 'erro inesperado'}`)
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error('Falha ao exportar PDFs de avaliações de experiência.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

export {}
