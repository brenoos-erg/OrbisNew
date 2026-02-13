import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { getDocuSignAccessToken } from '../src/lib/signature/providers/docusign/auth'

async function main() {
  try {
    const token = await getDocuSignAccessToken()
    console.log('✅ Token gerado com sucesso!')
    console.log(token.slice(0, 60) + '...')
  } catch (err: any) {
    console.error('❌ Erro ao gerar token:')
    console.error(err?.message || err)
    process.exit(1)
  }
}

main()
