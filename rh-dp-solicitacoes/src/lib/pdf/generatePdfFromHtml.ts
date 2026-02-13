import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
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

const requireModule = createRequire(import.meta.url)

async function getRuntimeModule(moduleName: string): Promise<any | null> {
  try {
    return await import(moduleName)
  } catch {
    try {
      return requireModule(moduleName)
    } catch {
      return null
    }
  }
}

const currentFilePath = fileURLToPath(import.meta.url)
const templateDir = path.resolve(path.dirname(currentFilePath), '..', '..', 'templates')

const templateCandidates = [
  'termo_responsabilidade.hbs',
  'termo_responsabilidades.hbs',
].map((templateFile) => path.join(templateDir, templateFile))

async function resolveTemplatePath() {
  for (const candidatePath of templateCandidates) {
    try {
      await access(candidatePath)
      return candidatePath
    } catch {
      continue
    }
  }

  throw new PdfGenerationError(
    'Template do termo de responsabilidade não encontrado.',
    500,
    `Arquivos esperados em: ${templateCandidates.join(' ou ')}`,
  )
}

export async function generatePdfFromHtml(data: TermoTemplateData): Promise<Buffer> {
  const templatePath = await resolveTemplatePath()
  const templateSource = await readFile(templatePath, 'utf-8')

  const handlebars = await getRuntimeModule('handlebars')
  if (!handlebars) {
    throw new PdfGenerationError(
      'Dependência Handlebars não está disponível para renderizar o termo.',
      500,
      'Instale com: npm install handlebars',
    )
  }

  const html = handlebars.default?.compile(templateSource)(data) ?? handlebars.compile(templateSource)(data)

  const playwright = await getRuntimeModule('playwright')
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