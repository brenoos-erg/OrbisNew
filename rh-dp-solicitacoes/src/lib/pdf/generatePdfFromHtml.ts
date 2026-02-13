import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type TermoTemplateData = {
  protocolo: string
  dataHora: string
  nomeSolicitante: string
  email: string
  login: string
  telefone: string
  centroCusto: string
  equipamentoNome: string
  equipamentoModelo: string
  patrimonio: string
  regras: string[]
  aceite: string
}

export class PdfGenerationError extends Error {
  statusCode: number
  detail?: string

  constructor(message: string, statusCode = 500, detail?: string) {
    super(message)
    this.name = 'PdfGenerationError'
    this.statusCode = statusCode
    this.detail = detail
  }
}

function getRuntimeModule(moduleName: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = new Function('name', 'return require(name)') as (name: string) => any
    return req(moduleName)
  } catch {
    return null
  }
}

const currentFilePath = fileURLToPath(import.meta.url)
const templatePath = path.resolve(
  path.dirname(currentFilePath),
  '..',
  '..',
  'templates',
  'termo_responsabilidade.hbs',
)

export async function generatePdfFromHtml(data: TermoTemplateData): Promise<Buffer> {
  try {
    await access(templatePath)
  } catch {
    throw new PdfGenerationError(
      'Template do termo de responsabilidade não encontrado.',
      500,
      `Arquivo esperado em: ${templatePath}`,
    )
  }

  const templateSource = await readFile(templatePath, 'utf-8')

  const handlebars = getRuntimeModule('handlebars')
  if (!handlebars) {
    throw new PdfGenerationError(
      'Dependência Handlebars não está disponível para renderizar o termo.',
      500,
      'Instale com: npm install handlebars',
    )
  }

  const html = handlebars.compile(templateSource)(data)

  const playwright = getRuntimeModule('playwright')
  if (!playwright?.chromium) {
    throw new PdfGenerationError(
      'Não foi possível gerar o PDF automaticamente porque o Playwright não está instalado no ambiente.',
      422,
      'Instale com: npm install playwright && npx playwright install chromium',
    )
  }

  const browser = await playwright.chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}