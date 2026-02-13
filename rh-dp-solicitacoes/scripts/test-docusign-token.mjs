import { getDocuSignAccessToken } from '../src/lib/signature/providers/docusign/auth.ts'

getDocuSignAccessToken()
  .then((token) => {
    console.log('✅ Token gerado com sucesso!')
    console.log(token.slice(0, 60) + '...')
  })
  .catch((err) => {
    console.error('❌ Erro ao gerar token:')
    console.error(err?.message || err)
  })
