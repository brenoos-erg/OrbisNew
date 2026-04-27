const assert = require('node:assert/strict')
const fs = require('node:fs')

const sentPage = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/page.tsx', 'utf8')
const receivedPage = fs.readFileSync('src/app/dashboard/solicitacoes/recebidas/page.tsx', 'utf8')
const detailModal = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')
const statusBadge = fs.readFileSync('src/components/solicitacoes/SolicitationStatusBadge.tsx', 'utf8')
const themeProvider = fs.readFileSync('src/components/theme/ThemeProvider.tsx', 'utf8')
const globals = fs.readFileSync('src/app/globals.css', 'utf8')

assert.match(sentPage, /className="app-page"/, 'Enviadas deve usar app-page')
assert.match(sentPage, /app-filter-bar/, 'Enviadas deve usar filtro padronizado')
assert.match(sentPage, /app-table-wrapper/, 'Enviadas deve usar tabela padronizada')
assert.doesNotMatch(sentPage, /text-black/, 'Enviadas não deve usar text-black')

assert.match(receivedPage, /className="app-page p-6"/, 'Recebidas deve usar app-page')
assert.match(receivedPage, /className="app-filter-bar"/, 'Recebidas deve usar app-filter-bar')
assert.match(receivedPage, /className="app-table-wrapper/, 'Recebidas deve usar app-table-wrapper')

assert.match(detailModal, /app-modal-overlay/, 'Modal deve usar overlay global')
assert.match(detailModal, /app-modal-panel/, 'Modal deve usar painel global')
assert.doesNotMatch(detailModal, /text-black/, 'Modal não deve usar text-black')

assert.match(statusBadge, /aria-label={`Status: \$\{presentation\.label\}`}/, 'Badge deve manter label acessível')

assert.match(themeProvider, /STORAGE_KEY = 'rh-dp-theme'/, 'Tema deve persistir em localStorage')
assert.match(themeProvider, /root\.dataset\.theme = resolved/, 'Tema resolvido deve ser aplicado no HTML')

assert.match(globals, /\.app-modal-overlay\s*\{/, 'globals.css deve definir app-modal-overlay')
assert.match(globals, /\.app-modal-panel\s*\{/, 'globals.css deve definir app-modal-panel')

console.log('solicitacoes-dark-regression.test.cjs: ok')
