import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @type {import('next').NextConfig}
 *
 * Observação: alguns ambientes (como proxies ou servidores que publicam o app
 * dentro de um subcaminho, ex.: `/doc`) precisam que o Next inclua esse
 * prefixo nas URLs dos chunks estáticos. Caso contrário, o navegador tentará
 * buscar arquivos em caminhos sem o prefixo e o resultado serão 404 como os
 * exibidos no DevTools.
 */
const basePath = process.env.NEXT_BASE_PATH ?? ''

const sanitizedBasePath = basePath
  ? basePath.startsWith('/')
    ? basePath.replace(/\/$/, '')
    : `/${basePath.replace(/\/$/, '')}`
  : ''

const projectRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  basePath: sanitizedBasePath || undefined,
  assetPrefix: sanitizedBasePath || undefined,
  turbopack: {
    root: projectRoot,
  },
}

export default nextConfig