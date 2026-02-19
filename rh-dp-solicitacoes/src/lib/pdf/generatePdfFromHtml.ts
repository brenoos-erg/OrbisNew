import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import Handlebars from 'handlebars'
import { chromium } from 'playwright'

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


const templatePath = path.resolve(process.cwd(), 'src', 'templates', 'termo_responsabilidade.hbs')
const logoCandidates = [
  path.join(process.cwd(), 'public', 'erg-logotipo.png'),
  path.join(process.cwd(), 'erg-logotipo.png'),
]

async function resolveTemplatePath() {
  try {
    await access(templatePath)
    return templatePath
  } catch {
    throw new PdfGenerationError(
      'Template do termo de responsabilidade não encontrado.',
      500,
      `Arquivo esperado em: ${templatePath}`,
    )
  }

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
  const resolvedTemplatePath = await resolveTemplatePath()
  const templateSource = await readFile(resolvedTemplatePath, 'utf-8')


  const logoDataUri = data.logoDataUri || (await resolveLogoDataUri())
  const html = Handlebars.compile(templateSource)({
    ...data,
    logoDataUri,
  })

  let browser: any
  try {
    browser = await chromium.launch({ headless: true })
  } catch (error: any) {
    throw new PdfGenerationError(
      'Chromium do Playwright indisponível para geração de PDF.',
      409,
      error?.message || 'Execute: npx playwright install chromium',
    )
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}