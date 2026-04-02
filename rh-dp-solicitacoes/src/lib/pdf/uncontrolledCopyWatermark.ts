const WATERMARK_TEXT = 'CÓPIA NÃO CONTROLADA'

const TEXT_COLOR = '0.58 0.58 0.58'
const DEFAULT_PAGE_WIDTH = 595
const DEFAULT_PAGE_HEIGHT = 842
const WATERMARK_MARGIN = 28

const escapePdfText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

type PdfValidation = { valid: true } | { valid: false; reason: string }

export function validatePdfBuffer(pdfBuffer: Buffer): PdfValidation {
  if (!pdfBuffer?.length) return { valid: false, reason: 'arquivo vazio' }

  const headerProbe = pdfBuffer.subarray(0, Math.min(1024, pdfBuffer.length)).toString('latin1')
  if (!headerProbe.includes('%PDF-')) {
    return { valid: false, reason: 'assinatura %PDF- ausente no cabeçalho' }
  }

  const tailProbe = pdfBuffer.subarray(Math.max(0, pdfBuffer.length - 2048)).toString('latin1')
  if (!tailProbe.includes('%%EOF')) {
    return { valid: false, reason: 'marcador %%EOF ausente no final do arquivo' }
  }

  return { valid: true }
}

function validatePdfCompatibilityForMutation(source: string): PdfValidation {
  if (/\/Type\s*\/XRef/.test(source)) {
    return { valid: false, reason: 'PDF usa stream de xref (não suportado pela estratégia atual de marca d\'água)' }
  }

  if (/\/Type\s*\/ObjStm/.test(source)) {
    return { valid: false, reason: 'PDF usa object streams (não suportado pela estratégia atual de marca d\'água)' }
  }

  return { valid: true }
}
const parseMediaBox = (objectBody: string) => {
  const match = objectBody.match(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/)
  if (!match) return { width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT }

  const x1 = Number(match[1])
  const y1 = Number(match[2])
  const x2 = Number(match[3])
  const y2 = Number(match[4])

  const width = Number.isFinite(x2 - x1) && x2 - x1 > 0 ? x2 - x1 : DEFAULT_PAGE_WIDTH
  const height = Number.isFinite(y2 - y1) && y2 - y1 > 0 ? y2 - y1 : DEFAULT_PAGE_HEIGHT

  return { width, height }
}

const buildWatermarkStream = (width: number, height: number) => {
  const fontSize = Math.max(16, Math.min(26, Math.round(Math.min(width, height) * 0.034)))
  const radians = (-32 * Math.PI) / 180
  const cos = Math.cos(radians).toFixed(5)
  const sin = Math.sin(radians).toFixed(5)
  const centerX = width * 0.19
  const centerY = height * 0.54
  const secondaryX = width * 0.08
  const secondaryY = Math.max(WATERMARK_MARGIN * 2.2, height * 0.28)

  const watermarks: string[] = [
    'BT',
    `${TEXT_COLOR} rg`,
    `/Fwm ${fontSize} Tf`,
    `${cos} ${sin} ${(-Number(sin)).toFixed(5)} ${cos} ${centerX.toFixed(2)} ${centerY.toFixed(2)} Tm`,
    `(${escapePdfText(WATERMARK_TEXT)}) Tj`,
    'ET',
    'BT',
    `${TEXT_COLOR} rg`,
    `/Fwm ${Math.max(14, Math.round(fontSize * 0.86))} Tf`,
    `${cos} ${sin} ${(-Number(sin)).toFixed(5)} ${cos} ${secondaryX.toFixed(2)} ${secondaryY.toFixed(2)} Tm`,
    `(${escapePdfText(WATERMARK_TEXT)}) Tj`,
    'ET',
  ]

  const commands = [
    'q',
    '/GSWm gs',
    ...watermarks,

    'Q',
  ].join('\n')

  return `${commands}\n`
}

const appendResourceEntry = (resourcesBody: string, key: string, objectId: number) => {
  const regex = new RegExp(`/${key}\\s*<<([\\s\\S]*?)>>`)
  const match = resourcesBody.match(regex)
  if (match) {
    if (match[1].includes('/Fwm ') || match[1].includes('/GSWm ')) return resourcesBody
    return resourcesBody.replace(regex, `/${key} <<${match[1]} /${key === 'Font' ? 'Fwm' : 'GSWm'} ${objectId} 0 R>>`)
  }

  if (key === 'Font') return `${resourcesBody}\n/Font << /Fwm ${objectId} 0 R >>`
  return `${resourcesBody}\n/ExtGState << /GSWm ${objectId} 0 R >>`
}

const ensureResources = (pageBody: string, fontObjectId: number, gsObjectId: number) => {
  if (!/\/Resources/.test(pageBody)) {
    return pageBody.replace('>>', `\n/Resources << /Font << /Fwm ${fontObjectId} 0 R >> /ExtGState << /GSWm ${gsObjectId} 0 R >> >>\n>>`)
  }

  return pageBody.replace(/\/Resources\s*<<([\s\S]*?)>>/, (_full, inner) => {
    let resources = inner
    resources = appendResourceEntry(resources, 'Font', fontObjectId)
    resources = appendResourceEntry(resources, 'ExtGState', gsObjectId)
    return `/Resources <<${resources}>>`
  })
}

const ensureContentsArray = (pageBody: string, streamObjectId: number) => {
  const contentsArrayMatch = pageBody.match(/\/Contents\s*\[([\s\S]*?)\]/)
  if (contentsArrayMatch) {
    const current = contentsArrayMatch[1]
    if (current.includes(`${streamObjectId} 0 R`)) return pageBody
    return pageBody.replace(/\/Contents\s*\[([\s\S]*?)\]/, `/Contents [${streamObjectId} 0 R ${current}]`)
  }

  const singleRefMatch = pageBody.match(/\/Contents\s+(\d+)\s+\d+\s+R/)
  if (singleRefMatch) {
    return pageBody.replace(/\/Contents\s+\d+\s+\d+\s+R/, `/Contents [${streamObjectId} 0 R ${singleRefMatch[1]} 0 R]`)
  }

  return pageBody.replace('>>', `\n/Contents [${streamObjectId} 0 R]\n>>`)
}


export function hasUncontrolledCopyWatermark(pdfBuffer: Buffer): boolean {
  if (!pdfBuffer?.length) return false
  return pdfBuffer.toString('latin1').includes(WATERMARK_TEXT)
}
export function applyUncontrolledCopyWatermark(pdfBuffer: Buffer): Buffer {
  const inputValidation = validatePdfBuffer(pdfBuffer)
  if (!inputValidation.valid) {
    throw new Error(`PDF inválido para marca d'água: ${inputValidation.reason}.`)
  }

  const source = pdfBuffer.toString('latin1')
  const compatibilityValidation = validatePdfCompatibilityForMutation(source)
  if (!compatibilityValidation.valid) {
    throw new Error(`PDF incompatível com marca d'água: ${compatibilityValidation.reason}.`)
  }

  const objectRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g
  const objects: Array<{ id: number; generation: number; full: string; body: string }> = []

  let objectMatch: RegExpExecArray | null
  while ((objectMatch = objectRegex.exec(source)) !== null) {
    objects.push({
      id: Number(objectMatch[1]),
      generation: Number(objectMatch[2]),
      full: objectMatch[0],
      body: objectMatch[3],
    })
  }

  if (!objects.length) {
    throw new Error('PDF inválido: nenhum objeto encontrado para aplicar marca d\'água.')
  }

  const pageObjects = objects.filter((entry) => /\/Type\s*\/Page(?!s)/.test(entry.body))
  if (!pageObjects.length) {
    throw new Error('PDF inválido: nenhuma página encontrada para aplicar marca d\'água.')
  }

  let nextObjectId = Math.max(...objects.map((entry) => entry.id)) + 1
  const fontObjectId = nextObjectId++
  const gsObjectId = nextObjectId++

   const appendedObjects: string[] = [
    `${fontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `${gsObjectId} 0 obj\n<< /Type /ExtGState /CA 0.07 /ca 0.07 >>\nendobj\n`,
  ]

  let updatedSource = source

  for (const pageObject of pageObjects) {
    const streamObjectId = nextObjectId++
    const { width, height } = parseMediaBox(pageObject.body)
    const stream = buildWatermarkStream(width, height)

    appendedObjects.push(
      `${streamObjectId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream\nendobj\n`,
    )

      let updatedPageBody = pageObject.body
    updatedPageBody = ensureResources(updatedPageBody, fontObjectId, gsObjectId)
    updatedPageBody = ensureContentsArray(updatedPageBody, streamObjectId)

    const updatedObject = `${pageObject.id} ${pageObject.generation} obj${updatedPageBody}endobj`
    updatedSource = updatedSource.replace(pageObject.full, updatedObject)
  }

  const merged = `${updatedSource}\n${appendedObjects.join('')}\n%%EOF\n`
  const outputBuffer = Buffer.from(merged, 'latin1')

  const outputValidation = validatePdfBuffer(outputBuffer)
  if (!outputValidation.valid) {
    throw new Error(`Falha ao validar PDF após aplicar marca d'água: ${outputValidation.reason}.`)
  }

  return outputBuffer
}