import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import Handlebars from 'handlebars'
import { chromium } from 'playwright'

async function main() {
  const templatePath = path.join(process.cwd(), 'src', 'templates', 'termo_responsabilidade.hbs')
  const logoPath = path.join(process.cwd(), 'public', 'erg-logotipo.png')
  const [templateSource, logoBuffer] = await Promise.all([
    readFile(templatePath, 'utf-8'),
    readFile(logoPath),
  ])

  const html = Handlebars.compile(templateSource)({
    protocolo: 'PROTOCOLO-TESTE-001',
    dataHora: new Date().toLocaleString('pt-BR'),
    nomeSolicitante: 'Usuário de Teste',
    email: 'usuario.teste@ergengenharia.com.br',
    login: 'u.teste',
    telefone: '(11) 99999-9999',
    centroCusto: 'TI - MATRIZ',
    equipamentoNome: 'Notebook',
    equipamentoModelo: 'Dell Latitude 5430',
    patrimonio: 'ERG-12345',
    regras: [
      'Utilizar o equipamento apenas para atividades corporativas.',
      'Comunicar imediatamente perdas, danos e incidentes de segurança.',
    ],
    aceite: 'Declaro ciência e aceitação integral dos termos acima.',
    logoDataUri: `data:image/png;base64,${logoBuffer.toString('base64')}`,
  })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle' })
  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  await browser.close()

  const outputDir = path.join(process.cwd(), 'tmp')
  await mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'termo.pdf')
  await writeFile(outputPath, pdf)

  console.log(`PDF gerado em: ${outputPath}`)
}

main().catch((error) => {
  console.error('Falha ao gerar PDF de teste:', error)
  process.exitCode = 1
})