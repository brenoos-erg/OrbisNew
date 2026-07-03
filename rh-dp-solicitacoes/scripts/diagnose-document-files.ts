import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { resolveDocumentFamilyRule } from '@/lib/documents/documentFamilyRules'

type DiagnosisRow = {
  code: string
  title: string
  revisionNumber: number
  status: string
  fileUrl: string | null
  extension: string
  family: string
  expectedDownload: 'native' | 'pdf'
  recommendedAction: string
}

function parseCodes(argv: string[]): string[] {
  const inline = argv.find((arg) => arg.startsWith('--codes='))?.slice('--codes='.length)
  const separateIndex = argv.findIndex((arg) => arg === '--codes')
  const raw = inline ?? (separateIndex >= 0 ? argv[separateIndex + 1] : '')
  return String(raw ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
}

function extensionOf(fileUrl: string | null): string {
  if (!fileUrl) return ''
  return path.extname(fileUrl.split('?')[0]?.split('#')[0] ?? '').toLowerCase()
}

function recommendedActionFor(fileUrl: string | null, family: string): string {
  const extension = extensionOf(fileUrl)
  if (family === 'non-controlled-native' && extension === '.pdf') {
    return 'Documento está salvo como PDF. Para baixar como Excel, é necessário substituir/republicar o arquivo original em .xls/.xlsx ou excluir por erro de postagem e cadastrar novamente com o arquivo correto.'
  }
  if (family === 'non-controlled-native') {
    return 'Sem conversão para PDF: baixar o arquivo original/nativo cadastrado.'
  }
  return 'Fluxo controlled-pdf esperado: baixar como PDF final controlado.'
}

async function main() {
  const codes = parseCodes(process.argv.slice(2))
  if (!codes.length) {
    throw new Error('Informe ao menos um código. Exemplo: npm run documents:diagnose-file -- --codes RQ.196,RQ.198')
  }

  const documents = await prisma.isoDocument.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      title: true,
      versions: {
        orderBy: [{ isCurrentPublished: 'desc' }, { revisionNumber: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: { revisionNumber: true, status: true, fileUrl: true },
      },
    },
    orderBy: { code: 'asc' },
  })

  const rows: DiagnosisRow[] = documents.map((document) => {
    const version = document.versions[0]
    const familyRule = resolveDocumentFamilyRule(document.code)
    return {
      code: document.code,
      title: document.title,
      revisionNumber: version?.revisionNumber ?? 0,
      status: version?.status ?? 'SEM_VERSAO',
      fileUrl: version?.fileUrl ?? null,
      extension: extensionOf(version?.fileUrl ?? null) || '(sem arquivo)',
      family: familyRule.family,
      expectedDownload: familyRule.family === 'non-controlled-native' ? 'native' : 'pdf',
      recommendedAction: recommendedActionFor(version?.fileUrl ?? null, familyRule.family),
    }
  })

  const found = new Set(rows.map((row) => row.code.toUpperCase()))
  for (const code of codes) {
    if (!found.has(code.toUpperCase())) {
      const familyRule = resolveDocumentFamilyRule(code)
      rows.push({
        code,
        title: '(não encontrado)',
        revisionNumber: 0,
        status: 'NAO_ENCONTRADO',
        fileUrl: null,
        extension: '(sem arquivo)',
        family: familyRule.family,
        expectedDownload: familyRule.family === 'non-controlled-native' ? 'native' : 'pdf',
        recommendedAction: 'Documento não encontrado na base consultada.',
      })
    }
  }

  console.table(rows)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
