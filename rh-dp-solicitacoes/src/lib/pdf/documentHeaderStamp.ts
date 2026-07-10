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

const appendFontResource = (resourcesBody: string, fontObjectId: number) => {
  const match = resourcesBody.match(/\/Font\s*<<([\s\S]*?)>>/)
  if (match) {
    if (match[1].includes('/Fdh ')) return resourcesBody
    return resourcesBody.replace(/\/Font\s*<<([\s\S]*?)>>/, `/Font <<${match[1]} /Fdh ${fontObjectId} 0 R>>`)
  }

  return `${resourcesBody}\n/Font << /Fdh ${fontObjectId} 0 R >>`
}

const ensureResources = (pageBody: string, fontObjectId: number) => {
  if (!/\/Resources/.test(pageBody)) {
    return pageBody.replace('>>', `\n/Resources << /Font << /Fdh ${fontObjectId} 0 R >> >>\n>>`)
  }

  return pageBody.replace(/\/Resources\s*<<([\s\S]*?)>>/, (_full, inner) => `/Resources <<${appendFontResource(inner, fontObjectId)}>>`)
}

const ensureContentsArray = (pageBody: string, streamObjectId: number) => {
  const contentsArrayMatch = pageBody.match(/\/Contents\s*\[([\s\S]*?)\]/)
  if (contentsArrayMatch) {
    const current = contentsArrayMatch[1]
    if (current.includes(`${streamObjectId} 0 R`)) return pageBody
    return pageBody.replace(/\/Contents\s*\[([\s\S]*?)\]/, `/Contents [${current} ${streamObjectId} 0 R]`)
  }

  const singleRefMatch = pageBody.match(/\/Contents\s+(\d+)\s+\d+\s+R/)
  if (singleRefMatch) {
    return pageBody.replace(/\/Contents\s+\d+\s+\d+\s+R/, `/Contents [${singleRefMatch[1]} 0 R ${streamObjectId} 0 R]`)
  }

  return pageBody.replace('>>', `\n/Contents [${streamObjectId} 0 R]\n>>`)
}

const buildHeaderStream = (width: number, height: number, headerLine: string) => {
  const clampedWidth = Math.max(220, width - 80)
  const text = headerLine.length > 250 ? `${headerLine.slice(0, 247)}...` : headerLine
  const commands = [
    'q',
    '0.15 0.15 0.15 rg',
    '/Fdh 8 Tf',
    `1 0 0 1 28 ${(height - 24).toFixed(2)} Tm`,
    `(${escapePdfText(text)}) Tj`,
    '0.82 0.82 0.82 RG',
    '0.5 w',
    `28 ${(height - 30).toFixed(2)} m ${Math.min(width - 28, 28 + clampedWidth).toFixed(2)} ${(height - 30).toFixed(2)} l S`,
    'Q',
  ].join('\n')

  return `${commands}\n`
}

export function applyDocumentHeaderStamp(pdfBuffer: Buffer, headerLine: string): Buffer {
  if (!pdfBuffer?.length || !headerLine?.trim()) return pdfBuffer

  const source = pdfBuffer.toString('latin1')
  if (/\/Type\s*\/XRef/.test(source) || /\/Type\s*\/ObjStm/.test(source)) {
    throw new Error('PDF incompatível com cabeçalho documental (usa xref stream/object stream).')
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

  const pageObjects = objects.filter((entry) => /\/Type\s*\/Page(?!s)/.test(entry.body))
  if (!pageObjects.length) return pdfBuffer

  let nextObjectId = Math.max(...objects.map((entry) => entry.id)) + 1
  const fontObjectId = nextObjectId++
  const appendedObjects: string[] = [`${fontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`]

  let updatedSource = source

  for (const pageObject of pageObjects) {
    const streamObjectId = nextObjectId++
    const { width, height } = parseMediaBox(pageObject.body)
    const stream = buildHeaderStream(width, height, headerLine)

    appendedObjects.push(
      `${streamObjectId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream\nendobj\n`,
    )

    let updatedPageBody = pageObject.body
    updatedPageBody = ensureResources(updatedPageBody, fontObjectId)
    updatedPageBody = ensureContentsArray(updatedPageBody, streamObjectId)

    const updatedObject = `${pageObject.id} ${pageObject.generation} obj${updatedPageBody}endobj`
    updatedSource = updatedSource.replace(pageObject.full, updatedObject)
  }

  return Buffer.from(`${updatedSource}\n${appendedObjects.join('')}\n%%EOF\n`, 'latin1')
}

export function hasDocumentCornerRevisionStamp(pdfBuffer: Buffer, documentCode: string, revisionNumber: number): boolean {
  if (!pdfBuffer?.length) return false
  const marker = `DOC_REV_STAMP:${documentCode}:REV:${revisionNumber}`
  return pdfBuffer.toString('latin1').includes(marker)
}

const buildCornerRevisionStream = (width: number, height: number, documentCode: string, revisionNumber: number) => {
  const label = `${documentCode} | Rev. ${String(revisionNumber).padStart(2, '0')}`
  const marker = `DOC_REV_STAMP:${documentCode}:REV:${revisionNumber}`
  const fontSize = 7
  const textWidth = Math.min(width - 32, label.length * fontSize * 0.55)
  const x = Math.max(16, width - textWidth - 18)
  const y = Math.max(16, height - 18)
  const commands = [
    `% ${escapePdfText(marker)}`,
    'q',
    '1 1 1 rg',
    `${(x - 3).toFixed(2)} ${(y - 3).toFixed(2)} ${(textWidth + 6).toFixed(2)} 11 re f`,
    '0.2 0.2 0.2 rg',
    '/Fdh 7 Tf',
    `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`,
    `(${escapePdfText(label)}) Tj`,
    'Q',
  ].join('\n')
  return `${commands}\n`
}

export function applyDocumentCornerRevisionStamp(pdfBuffer: Buffer, options: { documentCode: string; revisionNumber: number }): Buffer {
  const documentCode = options.documentCode?.trim()
  if (!pdfBuffer?.length || !documentCode || options.revisionNumber === undefined || options.revisionNumber === null) return pdfBuffer
  if (hasDocumentCornerRevisionStamp(pdfBuffer, documentCode, options.revisionNumber)) return pdfBuffer

  const source = pdfBuffer.toString('latin1')
  if (/\/Type\s*\/XRef/.test(source) || /\/Type\s*\/ObjStm/.test(source)) {
    throw new Error('PDF incompatível com carimbo de revisão (usa xref stream/object stream).')
  }

  const objectRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g
  const objects: Array<{ id: number; generation: number; full: string; body: string }> = []
  let objectMatch: RegExpExecArray | null
  while ((objectMatch = objectRegex.exec(source)) !== null) {
    objects.push({ id: Number(objectMatch[1]), generation: Number(objectMatch[2]), full: objectMatch[0], body: objectMatch[3] })
  }
  const pageObjects = objects.filter((entry) => /\/Type\s*\/Page(?!s)/.test(entry.body))
  if (!pageObjects.length) return pdfBuffer

  let nextObjectId = Math.max(...objects.map((entry) => entry.id)) + 1
  const fontObjectId = nextObjectId++
  const appendedObjects: string[] = [`${fontObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`]
  let updatedSource = source

  for (const pageObject of pageObjects) {
    const streamObjectId = nextObjectId++
    const { width, height } = parseMediaBox(pageObject.body)
    const stream = buildCornerRevisionStream(width, height, documentCode, options.revisionNumber)
    appendedObjects.push(`${streamObjectId} 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream\nendobj\n`)
    let updatedPageBody = ensureResources(pageObject.body, fontObjectId)
    updatedPageBody = ensureContentsArray(updatedPageBody, streamObjectId)
    updatedSource = updatedSource.replace(pageObject.full, `${pageObject.id} ${pageObject.generation} obj${updatedPageBody}endobj`)
  }
  return Buffer.from(`${updatedSource}\n${appendedObjects.join('')}\n%%EOF\n`, 'latin1')
}
