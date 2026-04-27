const assert = require('node:assert/strict')
const fs = require('node:fs')

const globals = fs.readFileSync('src/app/globals.css', 'utf8')
const dashboardLayout = fs.readFileSync('src/app/dashboard/layout.tsx', 'utf8')
const refusalNew = fs.readFileSync('src/app/dashboard/direito-de-recusa/nova/page.tsx', 'utf8')
const refusalDashboard = fs.readFileSync('src/app/dashboard/direito-de-recusa/RefusalDashboardClient.tsx', 'utf8')
const myRefusals = fs.readFileSync('src/app/dashboard/direito-de-recusa/minhas/MyRefusalsClient.tsx', 'utf8')
const ncList = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/NaoConformidadesClient.tsx', 'utf8')

assert.match(globals, /--background:/, 'globals.css precisa definir token --background')
assert.match(globals, /--card-elevated:/, 'globals.css precisa definir token --card-elevated')
assert.match(globals, /--table-row-hover:/, 'globals.css precisa definir token --table-row-hover')
assert.match(globals, /\.app-card\s*\{/, 'globals.css precisa expor classe utilitária .app-card')
assert.match(globals, /\.app-input[\s\S]*\.app-select[\s\S]*\.app-textarea/s, 'globals.css precisa padronizar campos de formulário')
assert.match(globals, /\.app-table\s*\{/, 'globals.css precisa expor classe utilitária .app-table')
assert.match(globals, /\.app-button-primary\s*\{/, 'globals.css precisa expor classe utilitária .app-button-primary')
assert.match(globals, /\.app-status-badge--success\s*\{/, 'globals.css precisa expor badge legível para status')

assert.match(dashboardLayout, /bg-\[var\(--background\)\]/, 'Dashboard layout deve usar token de background no shell')
assert.match(dashboardLayout, /border-\[var\(--border-subtle\)\]/, 'Dashboard layout deve usar token de borda')

assert.match(refusalNew, /className="app-input"/, 'Formulário de Direito de Recusa deve usar app-input')
assert.match(refusalNew, /className="app-select"/, 'Formulário de Direito de Recusa deve usar app-select')
assert.match(refusalNew, /className="app-textarea"/, 'Formulário de Direito de Recusa deve usar app-textarea')

assert.match(refusalDashboard, /className="app-table"/, 'Painel de Direito de Recusa deve usar app-table')
assert.match(myRefusals, /className="app-filter-bar"/, 'Tela Minhas Recusas deve usar app-filter-bar')
assert.match(ncList, /className="app-table"/, 'Lista de Não Conformidades deve usar app-table')
assert.match(ncList, /className="app-filter-bar"/, 'Lista de Não Conformidades deve usar app-filter-bar')

console.log('dark-mode-ux-regression.test.cjs: ok')
