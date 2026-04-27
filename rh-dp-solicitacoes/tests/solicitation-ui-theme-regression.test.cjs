const assert = require('node:assert/strict')
const fs = require('node:fs')

const themeProviderSource = fs.readFileSync('src/components/theme/ThemeProvider.tsx', 'utf8')
const themeToggleSource = fs.readFileSync('src/components/theme/ThemeToggle.tsx', 'utf8')

assert.match(
  themeProviderSource,
  /root\.classList\.toggle\('dark', resolved === 'dark'\)/,
  'ThemeProvider deve alternar a classe dark no html.',
)

assert.match(
  themeProviderSource,
  /localStorage\.setItem\(STORAGE_KEY, nextTheme\)/,
  'ThemeProvider deve persistir o tema no localStorage.',
)

assert.match(
  themeProviderSource,
  /window\.matchMedia\('\(prefers-color-scheme: dark\)'\)/,
  'ThemeProvider deve suportar fallback de tema do sistema.',
)

assert.match(
  themeToggleSource,
  /Claro[\s\S]*Escuro[\s\S]*Sistema/s,
  'ThemeToggle deve exibir as opções Claro/Escuro/Sistema.',
)

console.log('solicitation-ui-theme-regression.test.cjs: ok')
