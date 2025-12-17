import JSZip from 'jszip'

export type ParsedUserRow = {
  rowNumber: number
  email?: string
  name?: string
  login?: string
  department?: string
  costCenter?: string
  role?: string
}

type HeaderKey = keyof Omit<ParsedUserRow, 'rowNumber'>

type NormalizedHeaders = Record<string, HeaderKey>

function normalizeHeaderName(raw: string) {
  return raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const headerMap: NormalizedHeaders = {
  email: 'email',
  emailaddress: 'email',
  nome: 'name',
  name: 'name',
  fullname: 'name',
  fullnombre: 'name',
  login: 'login',
  usuario: 'login',
  username: 'login',
  departamento: 'department',
  department: 'department',
  costcenter: 'costCenter',
  costcenters: 'costCenter',
  centrodecusto: 'costCenter',
  centrocustos: 'costCenter',
  centro_custo: 'costCenter',
  centrodecostos: 'costCenter',
  role: 'role',
  papel: 'role',
  perfil: 'role',
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function columnIndexFromRef(ref: string) {
  const match = ref.match(/([A-Z]+)/)
  if (!match) return 0
  const letters = match[1]
  let index = 0
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64)
  }
  return index - 1
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = []
  const siRegex = /<si[^>]*>([\s\S]*?)<\/si>/g
  let siMatch: RegExpExecArray | null

  while ((siMatch = siRegex.exec(xml))) {
    const textMatches = siMatch[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g)
    if (textMatches) {
      const text = textMatches
        .map((t) => decodeEntities(t.replace(/<[^>]+>/g, '')))
        .join('')
      strings.push(text)
    } else {
      strings.push('')
    }
  }

  return strings
}

function parseSheet(xml: string, sharedStrings: string[]) {
  const rows: Array<{ rowNumber: number; values: string[] }> = []
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(xml))) {
    const rowTag = rowMatch[0]
    const rowNumberMatch = rowTag.match(/r="(\d+)"/)
    const rowNumber = rowNumberMatch ? Number(rowNumberMatch[1]) : rows.length + 1

    const cellContent = rowMatch[1]
    const cells: string[] = []
    const cellRegex = /<c([^>]*)>([\s\S]*?)<\/c>/g
    let cellMatch: RegExpExecArray | null

    while ((cellMatch = cellRegex.exec(cellContent))) {
      const attrs = cellMatch[1]
      const valueContent = cellMatch[2]
      const refMatch = attrs.match(/r="([A-Z]+\d+)"/)
      const colIndex = refMatch ? columnIndexFromRef(refMatch[1]) : cells.length

      let value = ''
      const isSharedString = /t="s"/.test(attrs)
      const inlineStringMatch = valueContent.match(/<is>\s*<t[^>]*>([\s\S]*?)<\/t>\s*<\/is>/)
      const rawValueMatch = valueContent.match(/<v>([\s\S]*?)<\/v>/)

      if (inlineStringMatch) {
        value = decodeEntities(inlineStringMatch[1])
      } else if (isSharedString && rawValueMatch) {
        const sharedIndex = Number(rawValueMatch[1])
        value = sharedStrings[sharedIndex] ?? ''
      } else if (rawValueMatch) {
        value = decodeEntities(rawValueMatch[1])
      }

      cells[colIndex] = value.trim()
    }

    rows.push({ rowNumber, values: cells })
  }

  return rows
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedUserRow[]> {
  const zip = await JSZip.loadAsync(buffer)
  const sheetPath = Object.keys(zip.files).find((path) =>
    /^xl\/worksheets\/sheet1\.xml$/i.test(path),
  )

  if (!sheetPath) {
    throw new Error('Planilha inválida: não foi possível localizar a primeira aba.')
  }

  const [sheetXml, sharedStringsXml] = await Promise.all([
    zip.file(sheetPath)?.async('text'),
    zip.file('xl/sharedStrings.xml')?.async('text'),
  ])

  if (!sheetXml) {
    throw new Error('Planilha inválida: conteúdo não encontrado.')
  }

  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : []
  const rows = parseSheet(sheetXml, sharedStrings)

  if (!rows.length) return []

  const headerRow = rows[0].values
  const headerMapping: Partial<Record<number, HeaderKey>> = {}

  headerRow.forEach((header, index) => {
    const normalized = normalizeHeaderName(header)
    const mapped = headerMap[normalized]
    if (mapped) {
      headerMapping[index] = mapped
    }
  })

  const parsedRows: ParsedUserRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const data: ParsedUserRow = { rowNumber: row.rowNumber }

    row.values.forEach((value, index) => {
      const key = headerMapping[index]
      if (!key) return
      const trimmed = value.trim()
      if (!trimmed) return

      if (key === 'name') data.name = trimmed
      if (key === 'email') data.email = trimmed
      if (key === 'login') data.login = trimmed
      if (key === 'department') data.department = trimmed
      if (key === 'costCenter') data.costCenter = trimmed
      if (key === 'role') data.role = trimmed
    })

    const hasData = Object.values({ ...data, rowNumber: undefined }).some(
      (value) => typeof value === 'string' && value.trim() !== '',
    )

    if (hasData) {
      parsedRows.push(data)
    }
  }

  return parsedRows
}