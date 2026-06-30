import fs from 'node:fs/promises'
import JSZip from 'jszip'

export type ParsedPositionDocument = Record<string, string | null>

const FIELD_LABELS = [
  ['indexador', 'Indexador'], ['revision', 'Revisão'], ['documentDate', 'Data'], ['name', 'Cargo'],
  ['managerPosition', 'Cargo do Gestor Imediato'], ['framing', 'Enquadramento'], ['areaSector', 'Área/Setor'], ['cbo', 'CBO'],
  ['summary', 'Descrição Sumária'], ['detailedDescription', 'Descrição Detalhada'], ['schooling', 'Escolaridade'], ['experience', 'Experiência'],
  ['necessaryKnowledge', 'Conhecimentos/Habilidades necessários'], ['desiredKnowledge', 'Conhecimentos/Habilidades desejáveis'],
  ['humanCompetencies', 'Competências humanas Gesto.Com'], ['functionalCompetencies', 'Competências funcionais Gesto.Com'],
  ['otherCompetencies', 'Outros'], ['complexity', 'Complexidade do cargo'], ['managementScope', 'Gestão'],
  ['confidentialDataAccess', 'Acesso a dados confidenciais'], ['responsibilities', 'Responsabilidades'],
] as const

function decodeXmlText(xml: string) {
  return xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export async function extractTextFromDocx(filePath: string) {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath))
  const documentXml = await zip.file('word/document.xml')?.async('string')
  if (!documentXml) throw new Error('DOCX inválido: word/document.xml não encontrado.')
  return decodeXmlText(documentXml)
}

function normalizeLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function parseDate(value?: string | null) {
  const match = (value ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : (value?.trim() || null)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function prepareTextForParsing(text: string) {
  let prepared = text.replace(/\r/g, '\n').replace(/[ \t]*:[ \t]*/g, ': ')
  const labelsByLength = [...FIELD_LABELS].map(([, label]) => label).sort((a, b) => b.length - a.length)
  for (const label of labelsByLength) {
    const escaped = escapeRegex(label)
    prepared = prepared.replace(new RegExp(`(?!^)(?<!\\n)(\\s+)(${escaped})(\\s*:?)`, 'gi'), '\n$2$3')
  }
  prepared = prepared.replace(/(^|\n)(Cargo)(\s+)(?!do Gestor Imediato)([^:\n]+)/gi, '$1Cargo: $4')
  return prepared
}

export function parsePositionDescriptionText(text: string): ParsedPositionDocument {
  const normalizedText = prepareTextForParsing(text)
  const labels = FIELD_LABELS.map(([key, label]) => ({ key, label, normalized: normalizeLabel(label) }))
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean)
  const parsed: ParsedPositionDocument = {}
  for (const { key } of labels) parsed[key] = null
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const normalizedLine = normalizeLabel(line.split(':')[0] ?? line)
    const found = labels.find((item) => normalizedLine === item.normalized || normalizedLine.endsWith(item.normalized))
    if (!found) continue
    const inlineValue = line.includes(':') ? line.slice(line.indexOf(':') + 1).trim() : ''
    const chunks: string[] = []
    if (inlineValue) chunks.push(inlineValue)
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j]
      const nextLabel = normalizeLabel(next.split(':')[0] ?? next)
      if (labels.some((item) => nextLabel === item.normalized || nextLabel.endsWith(item.normalized))) break
      chunks.push(next)
    }
    parsed[found.key] = chunks.join('\n').trim() || null
  }

  parsed.indexador = text.match(/DD\.RH\.\d+/i)?.[0]?.toUpperCase() || parsed.indexador || null
  parsed.revision = text.match(/Revis[aã]o\s*:?\s*([0-9A-Za-z.-]+)/i)?.[1] || parsed.revision || null
  parsed.documentDate = parseDate(text.match(/Data\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] || parsed.documentDate)
  parsed.cbo = text.match(/CBO\s*:?\s*(\d{4}-\d{2})/i)?.[1] || parsed.cbo || null
  return parsed
}
export function normalizePositionDocumentFields(parsed: ParsedPositionDocument) {
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as ParsedPositionDocument
}
export function mapParsedDocumentToPositionPayload(parsed: ParsedPositionDocument) {
  const p = normalizePositionDocumentFields(parsed)
  return { ...p, description: p.summary, sectorProject: p.areaSector, mainActivities: p.detailedDescription, requiredKnowledge: p.necessaryKnowledge, behavioralCompetencies: p.humanCompetencies, others: p.otherCompetencies }
}
