import { readFile } from 'node:fs/promises'
import path from 'node:path'

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

function getRuntimeModule(moduleName: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = new Function('name', 'return require(name)') as (name: string) => any
    return req(moduleName)
  } catch {
    return null
  }
}

export async function generatePdfFromHtml(data: TermoTemplateData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'src', 'templates', 'termo_responsabilidade.hbs')
  const templateSource = await readFile(templatePath, 'utf-8')

  const handlebars = getRuntimeModule('handlebars')
  const html = handlebars
    ? handlebars.compile(templateSource)(data)
    : templateSource
        .replace('{{protocolo}}', data.protocolo)
        .replace('{{dataHora}}', data.dataHora)
        .replace('{{nomeSolicitante}}', data.nomeSolicitante)

  const playwright = getRuntimeModule('playwright')
  if (!playwright?.chromium) {
    throw new Error(
      'Falha ao gerar PDF automaticamente: Playwright não está disponível no runtime. Instale playwright para habilitar geração automática.',
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