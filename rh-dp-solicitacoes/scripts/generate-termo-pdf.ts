import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generatePdfFromHtml } from '../src/lib/pdf/generatePdfFromHtml.ts'

async function main() {
  const pdfBuffer = await generatePdfFromHtml({
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
    regras: [],
    aceite: '',
  })

  const outputDir = path.join(process.cwd(), 'scripts')
  await mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'out-termo-responsabilidade.pdf')
  await writeFile(outputPath, pdfBuffer)

  console.log(`PDF gerado em: ${outputPath}`)
}

main().catch((error) => {
  console.error('Falha ao gerar PDF de teste:', error)
  process.exitCode = 1
})