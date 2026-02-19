import { prisma } from '@/lib/prisma'
import { generatePdfFromHtml } from '@/lib/pdf/generatePdfFromHtml'
import { uploadGeneratedFile } from '@/lib/storage/uploadGeneratedFile'

export const DEFAULT_TERMO_CLAUSES = [
  'Utilizar o equipamento exclusivamente para fins profissionais autorizados pela empresa.',
  'Preservar a integridade física e lógica do equipamento, comunicando imediatamente qualquer incidente.',
  'Não instalar softwares sem autorização prévia da área de TI.',
  'Devolver o equipamento quando solicitado ou no desligamento, com todos os acessórios recebidos.',
]

type GenerateTermoInput = {
  documentId: string
  assignmentId: string
  vistoriaObservacoes?: string | null
}

export async function generateAndUploadTermoResponsabilidadePdf(input: GenerateTermoInput) {
  const assignment = await prisma.documentAssignment.findUnique({
    where: { id: input.assignmentId },
    include: {
      document: {
        include: {
          solicitation: {
            include: {
              solicitante: true,
              costCenter: true,
            },
          },
        },
      },
    },
  })

  if (!assignment || assignment.documentId !== input.documentId) {
    throw new Error('Documento/atribuição inválidos para regeneração do termo.')
  }

  const solicitation = assignment.document.solicitation
  if (!solicitation) {
    throw new Error('Solicitação do termo não encontrada.')
  }

  const equipment = await prisma.tiEquipment.findFirst({
    where: { userId: assignment.userId, status: 'ASSIGNED' },
    orderBy: { updatedAt: 'desc' },
    select: { name: true, serialNumber: true, category: true, patrimonio: true },
  })

  const observacoes = (input.vistoriaObservacoes || '').trim()
  const pdfBuffer = await generatePdfFromHtml({
    protocolo: solicitation.protocolo,
    dataHora: new Date().toLocaleString('pt-BR'),
    nomeSolicitante: solicitation.solicitante.fullName,
    email: solicitation.solicitante.email,
    login: solicitation.solicitante.login || '-',
    telefone: solicitation.solicitante.phone || '-',
    centroCusto: solicitation.costCenter?.description || '-',
    equipamentoNome: equipment?.name || assignment.document.title,
    equipamentoModelo: equipment?.serialNumber || equipment?.category || '-',
    patrimonio: equipment?.patrimonio || '-',
    regras: DEFAULT_TERMO_CLAUSES,
    aceite: 'Declaro que li, compreendi e concordo integralmente com as regras acima.',
    vistoriaObservacoes: observacoes || '-',
  })

  const fileName = `termo-responsabilidade-${solicitation.protocolo}-${Date.now()}.pdf`
  const uploaded = await uploadGeneratedFile({ fileName, buffer: pdfBuffer, contentType: 'application/pdf' })

  return {
    url: uploaded.url,
    buffer: pdfBuffer,
  }
}