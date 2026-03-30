const WATERMARK_TEXT = 'CÓPIA NÃO CONTROLADA'

const TEXT_COLOR = '0.45 0.45 0.45'
const DEFAULT_PAGE_WIDTH = 595
const DEFAULT_PAGE_HEIGHT = 842

const escapePdfText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

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
  const fontSize = Math.max(34, Math.min(58, Math.round(Math.min(width, height) * 0.08)))
  const radians = (-35 * Math.PI) / 180
  const cos = Math.cos(radians).toFixed(5)
  const sin = Math.sin(radians).toFixed(5)
  const tx = (width * 0.16).toFixed(2)
  const ty = (height * 0.52).toFixed(2)

  const commands = [
    'q',
    '/GSWm gs',
    'BT',
    `${TEXT_COLOR} rg`,
    `/Fwm ${fontSize} Tf`,
    `${cos} ${sin} ${(-Number(sin)).toFixed(5)} ${cos} ${tx} ${ty} Tm`,
    `(${escapePdfText(WATERMARK_TEXT)}) Tj`,
    'ET',
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
    return pageBody.replace(/\/Contents\s*\[([\s\S]*?)\]/, `/Contents [${current} ${streamObjectId} 0 R]`)
  }

  const singleRefMatch = pageBody.match(/\/Contents\s+(\d+)\s+0\s+R/)
  if (singleRefMatch) {
    return pageBody.replace(/\/Contents\s+\d+\s+0\s+R/, `/Contents [${singleRefMatch[1]} 0 R ${streamObjectId} 0 R]`)
  }

  return pageBody.replace('>>', `\n/Contents [${streamObjectId} 0 R]\n>>`)
}

export function applyUncontrolledCopyWatermark(pdfBuffer: Buffer): Buffer {
  const source = pdfBuffer.toString('latin1')
  const objectRegex = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g
  const objects: Array<{ id: number; full: string; body: string }> = []

  let objectMatch: RegExpExecArray | null
  while ((objectMatch = objectRegex.exec(source)) !== null) {
    objects.push({ id: Number(objectMatch[1]), full: objectMatch[0], body: objectMatch[2] })
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
    `${gsObjectId} 0 obj\n<< /Type /ExtGState /CA 0.15 /ca 0.15 >>\nendobj\n`,
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

    const updatedObject = `${pageObject.id} 0 obj${updatedPageBody}endobj`
    updatedSource = updatedSource.replace(pageObject.full, updatedObject)
  }

  const watermarkHeader = `% UNCONTROLLED_COPY_WATERMARK_APPLIED\n`
  const merged = `${watermarkHeader}${updatedSource}\n${appendedObjects.join('')}\n`

  return Buffer.from(merged, 'latin1')
}