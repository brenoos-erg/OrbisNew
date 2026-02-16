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
  logoDataUri?: string
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

const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'))

function getRuntimeModule(moduleName: string): any | null {
  try {
    return requireFromProject(moduleName)
  } catch {
    return null
  }
}

const currentFilePath = fileURLToPath(import.meta.url)
const templateDir = path.resolve(path.dirname(currentFilePath), '..', '..', 'templates')
const projectRoot = process.cwd()

const templateCandidates = [
  'termo_responsabilidade.hbs',
  'termo_responsabilidades.hbs',
].map((templateFile) => path.join(templateDir, templateFile))

const logoCandidates = [
  path.join(projectRoot, 'public', 'erg-logotipo.png'),
  path.join(projectRoot, 'erg-logotipo.png'),
]

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

async function resolveLogoDataUri() {
  for (const candidatePath of logoCandidates) {
    try {
      await access(candidatePath)
      const logoBuffer = await readFile(candidatePath)
      return `data:image/png;base64,${logoBuffer.toString('base64')}`
    } catch {
      continue
    }
  }

  return ''
}

export async function generatePdfFromHtml(data: TermoTemplateData): Promise<Buffer> {
  const templatePath = await resolveTemplatePath()
  const templateSource = await readFile(templatePath, 'utf-8')

  const handlebars = getRuntimeModule('handlebars')
  if (!handlebars?.compile) {
    throw new PdfGenerationError(
      'Dependência Handlebars não está disponível para renderizar o termo.',
      500,
      'Instale com: npm install handlebars',
    )
  }

  const logoDataUri = data.logoDataUri || (await resolveLogoDataUri())
  const html = handlebars.compile(templateSource)({
    ...data,
    logoDataUri,
  })

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
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}