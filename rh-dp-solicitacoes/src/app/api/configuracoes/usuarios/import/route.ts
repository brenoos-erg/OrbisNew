import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createUserWithAuth, toLoginFromName } from '@/lib/users/createUserWithAuth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type ParsedRow = {
  fullName: string
  email: string
  login?: string
  phone?: string
  costCenter?: string
  password?: string
  firstAccess?: boolean
}

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9çãõáéíóúâêîôûàèìòùäëïöü]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBoolean(value: unknown) {
  if (value === undefined || value === null) return undefined
  const str = String(value).trim().toLowerCase()
  if (!str) return undefined
  return ['sim', 'yes', 'true', '1', 'y', 's'].includes(str)
}

function columnFromRef(ref: string) {
  const letters = ref.replace(/\d+/g, '')
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64)
  }
  return result - 1
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function parseSharedStrings(xml: string) {
  const regex = /<si[^>]*>([\s\S]*?)<\/si>/g
  const values: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml))) {
    const textMatch = match[1].match(/<t[^>]*>([\s\S]*?)<\/t>/)
    values.push(decodeXmlEntities(textMatch?.[1] || ''))
  }
  return values
}

function parseSheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = []
  const rowRegex = /<row[^>]*r="?(\d+)"?[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(xml))) {
    const rowNumber = Number(rowMatch[1])
    const cellsXml = rowMatch[2]
    const cellRegex = /<c[^>]*r="?([A-Z]+\d+)"?[^>]*?(?:t="(\w+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?.*?<\/c>/g
    const cells: Record<number, string> = {}
    let cellMatch: RegExpExecArray | null

    while ((cellMatch = cellRegex.exec(cellsXml))) {
      const ref = cellMatch[1]
      const type = cellMatch[2]
      const rawValue = cellMatch[3] ?? ''
      const columnIndex = columnFromRef(ref)

      let value = rawValue
      if (type === 's') value = sharedStrings[Number(rawValue)] ?? ''
      else if (type === 'inlineStr') {
        const inlineMatch = cellMatch[0].match(/<t[^>]*>([\s\S]*?)<\/t>/)
        value = inlineMatch?.[1] ?? ''
      }
      cells[columnIndex] = decodeXmlEntities(String(value))
    }

    const maxColumn = Math.max(-1, ...Object.keys(cells).map(Number))
    const rowValues: string[] = []
    for (let i = 0; i <= maxColumn; i++) {
      rowValues[i] = cells[i] ?? ''
    }
    rows[rowNumber - 1] = rowValues
  }

  return rows.filter(Boolean)
}

function rowsToObjects(rows: string[][]): ParsedRow[] {
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => normalizeHeader(String(h || '')))
  return rows.slice(1).map((cells) => {
    const map: Record<string, string> = {}
    headers.forEach((h, idx) => {
      map[h] = String(cells[idx] ?? '')
    })
    return {
      fullName: map['nome'] || map['nome completo'] || '',
      email: map['email'] || '',
      login: map['login'] || undefined,
      phone: map['telefone'] || undefined,
      costCenter: map['centro de custo'] || undefined,
      password: map['senha'] || undefined,
      firstAccess: parseBoolean(map['primeiro acesso']),
    }
  })
}

async function parseXlsx(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer)
  const sheet = zip.file('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error('Planilha sem dados na primeira aba.')

  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('text')
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : []

  const sheetXml = await sheet.async('text')
  const rows = parseSheetXml(sheetXml, sharedStrings)
  return rowsToObjects(rows)
}

function parseCsv(buffer: ArrayBuffer) {
  const text = new TextDecoder('utf-8').decode(buffer)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const headers = lines[0].split(delimiter).map((h) => normalizeHeader(h))

  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter)
    const map: Record<string, string> = {}
    headers.forEach((h, idx) => {
      map[h] = cells[idx]?.trim() ?? ''
    })
    return {
      fullName: map['nome'] || map['nome completo'] || '',
      email: map['email'] || '',
      login: map['login'] || undefined,
      phone: map['telefone'] || undefined,
      costCenter: map['centro de custo'] || undefined,
      password: map['senha'] || undefined,
      firstAccess: parseBoolean(map['primeiro acesso']),
    }
  })
}

async function parseSpreadsheet(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 2))
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  return isZip ? parseXlsx(buffer) : parseCsv(buffer)
}

function findCostCenterId(
  code: string | undefined,
  costCenters: { id: string; code: string | null; externalCode: string | null; description: string }[],
) {
  if (!code) return null
  const target = code.trim().toLowerCase()
  if (!target) return null
  const match = costCenters.find((cc) => {
    const options = [cc.externalCode, cc.code, cc.description]
    return options.some((item) => (item || '').toLowerCase() === target)
  })
  return match?.id ?? null
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Envie um arquivo .xlsx, .xls ou .csv com os usuários.' },
        { status: 400 },
      )
    }

    const buffer = await file.arrayBuffer()
    const rows = await parseSpreadsheet(buffer)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma linha encontrada na planilha.' },
        { status: 400 },
      )
    }

    const costCenters = await prisma.costCenter.findMany({
      select: { id: true, code: true, externalCode: true, description: true },
    })

    const errors: string[] = []
    let createdCount = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const lineNumber = i + 2 // considerando cabeçalho na linha 1
      const fullName = row.fullName.trim()
      const email = row.email.trim().toLowerCase()
      const login = (row.login || toLoginFromName(fullName)).trim().toLowerCase()
      const phone = row.phone?.trim() || null
      const costCenterId = findCostCenterId(row.costCenter, costCenters)
      const firstAccess = row.firstAccess ?? !row.password

      if (!fullName || !email || !login) {
        errors.push(`Linha ${lineNumber}: Nome, e-mail ou login inválidos.`)
        continue
      }

      try {
        await createUserWithAuth({
          fullName,
          email,
          login,
          phone,
          costCenterId,
          password: row.password || null,
          firstAccess,
        })
        createdCount += 1
      } catch (e: any) {
        const message =
          e?.code === 'P2002'
            ? 'E-mail ou login já cadastrado.'
            : e?.message || 'Erro inesperado.'
        errors.push(`Linha ${lineNumber} (${email}): ${message}`)
      }
    }

    return NextResponse.json({ created: createdCount, errors })
  } catch (e) {
    console.error('POST /api/configuracoes/usuarios/import error', e)
    return NextResponse.json(
      { error: 'Não foi possível importar a planilha.' },
      { status: 500 },
    )
  }
}