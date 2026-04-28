const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

function includesAll(haystack, needles, label) {
  for (const needle of needles) {
    assert.ok(haystack.includes(needle), `${label} deveria incluir: ${needle}`)
  }
}

function excludesAll(haystack, needles, label) {
  for (const needle of needles) {
    assert.ok(!haystack.includes(needle), `${label} não deveria incluir: ${needle}`)
  }
}

// ThemeProvider aplica claro/escuro/sistema
const themeProvider = read('src/components/theme/ThemeProvider.tsx')
includesAll(
  themeProvider,
  [
    "type Theme = 'light' | 'dark' | 'system'",
    "root.classList.toggle('dark'",
    'root.dataset.theme = resolved',
    "localStorage.setItem(STORAGE_KEY, nextTheme)",
    "window.matchMedia('(prefers-color-scheme: dark)')",
  ],
  'ThemeProvider',
)

// classes globais de UI existem
const globals = read('src/app/globals.css')
includesAll(
  globals,
  [
    '.app-page',
    '.app-card',
    '.app-input',
    '.app-table-wrapper',
    '.app-button-primary',
    '.app-button-warning',
    '.app-button-info',
    '.app-button-disabled',
    '.app-modal-overlay',
    '.app-modal-panel',
    '.app-alert-success',
    '.app-alert-error',
    '.app-alert-warning',
    '.app-alert-info',
    '.dark .bg-white',
  ],
  'globals.css',
)

// StatusBadge renderiza status principais
const statusMap = read('src/lib/solicitationStatusPresentation.ts')
includesAll(
  statusMap,
  [
    'ABERTA',
    'AGUARDANDO_ATENDIMENTO',
    'EM_ATENDIMENTO',
    'AGUARDANDO_APROVACAO',
    'AGUARDANDO_TERMO',
    'AGUARDANDO_AVALIACAO_GESTOR',
    'AGUARDANDO_FINALIZACAO_AVALIACAO',
    'CONCLUIDA',
    'CANCELADA',
  ],
  'solicitationStatusPresentation.ts',
)

// Modal sem classes fixas antigas
const modal = read('src/components/solicitacoes/SolicitationDetailModal.tsx')
includesAll(modal, ["const LABEL_RO = 'app-label'", "const INPUT_RO = 'app-readonly-card'", 'app-modal-overlay', 'app-modal-panel'], 'SolicitationDetailModal.tsx')
excludesAll(modal, ['text-slate-800', 'border-slate-300 bg-white text-slate-800'], 'SolicitationDetailModal.tsx')

// Fluxo compatível com dark
const fluxo = read('src/app/dashboard/configuracoes/fluxo-solicitacao/FluxoSolicitacaoClient.tsx')
includesAll(fluxo, ['app-surface', 'app-button-warning', 'Aplicar nova tramitação', 'app-input'], 'FluxoSolicitacaoClient.tsx')

// Enviadas compatível com dark
const enviadas = read('src/app/dashboard/solicitacoes/enviadas/page.tsx')
includesAll(enviadas, ['app-filter-bar', 'app-table-wrapper', 'app-select', 'app-input'], 'Solicitações enviadas')

// Recebidas compatível com dark
const recebidas = read('src/app/dashboard/solicitacoes/recebidas/page.tsx')
includesAll(recebidas, ['app-filter-bar', 'app-table-wrapper', 'SolicitationStatusBadge'], 'Solicitações recebidas')

// disabled não depende de branco puro no dark
includesAll(globals, ['.app-button-primary:disabled', '.app-button-disabled'], 'disabled buttons')

// página pública externa continua renderizando
const externo = read('src/app/solicitacoes/externo/page.tsx')
includesAll(externo, ['Canal externo de solicitações', 'onSubmit'], 'página externa')

// permissões não foram alteradas estruturalmente
const permissions = read('src/lib/permissions.ts')
includesAll(permissions, ['export async function canFeature', 'Action'], 'permissions.ts')

console.log('ui-global-regression.test.cjs: ok')
