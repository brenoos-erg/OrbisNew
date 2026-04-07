const NON_CONTROLLED_PREFIXES = new Set(['DOCEXT', 'RQ', 'LEG', 'DD', 'MAN'])
const CONTROLLED_PREFIXES = new Set(['PG', 'IT', 'COD', 'POL', 'MSIG'])

export type DocumentPipelineFamily = 'non-controlled-native' | 'controlled-pdf'

export type DocumentFamilyRule = {
  prefix: string
  family: DocumentPipelineFamily
}

function extractDocumentPrefix(documentCode: string): string {
  const normalized = String(documentCode ?? '').trim().toUpperCase()
  if (!normalized) return ''
  const matchedPrefix = normalized.match(/^[A-Z]+/)
  return matchedPrefix?.[0]?.trim() ?? ''
}

export function resolveDocumentFamilyRule(documentCode: string): DocumentFamilyRule {
  const prefix = extractDocumentPrefix(documentCode)

  if (NON_CONTROLLED_PREFIXES.has(prefix)) {
    return { prefix, family: 'non-controlled-native' }
  }

  if (CONTROLLED_PREFIXES.has(prefix)) {
    return { prefix, family: 'controlled-pdf' }
  }

  return { prefix, family: 'controlled-pdf' }
}

export function shouldUseControlledPdfFlow(documentCode: string): boolean {
  return resolveDocumentFamilyRule(documentCode).family === 'controlled-pdf'
}
