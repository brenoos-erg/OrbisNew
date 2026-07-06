const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const client = read('src/app/dashboard/sst/planos-de-acao/PlanosDeAcaoClient.tsx')
const responsaveisRoute = read('src/app/api/sst/plano-de-acao/responsaveis/route.ts')

assert.match(
  client,
  /className="w-full max-w-(4|5)xl rounded-xl bg-white shadow-xl"/,
  'modal de registro de PA deve usar largura maior que max-w-2xl',
)
assert.match(
  client,
  /<div className="col-span-full">[\s\S]*<Field label="Descrição \*">[\s\S]*className="app-input w-full min-h-32 resize-y"/,
  'descrição deve ocupar linha própria e textarea largo redimensionável',
)
assert.match(
  client,
  /md:col-span-6[\s\S]*Field label="Responsável"[\s\S]*md:col-span-3[\s\S]*Field label="Prazo"[\s\S]*md:col-span-3[\s\S]*Field label="Status"/,
  'responsável, prazo e status devem usar proporção 6/3/3 no grid',
)

assert.match(
  client,
  /\}, \[createModalOpen, responsaveis\.length\]\)/,
  'carregamento de responsáveis deve depender apenas da abertura do modal e da lista carregada',
)
assert.doesNotMatch(
  client,
  /\}, \[createModalOpen, responsaveis\.length, loadingResponsaveis\]\)/,
  'carregamento de responsáveis não deve depender de loadingResponsaveis para não cancelar a própria requisição',
)
assert.match(
  client,
  /const selectedResponsavel = responsaveis\.find\(\(user\) => user\.id === createForm\.responsavelId\)/,
  'formulário deve localizar o responsável selecionado antes do POST',
)
assert.match(
  client,
  /responsavelId: createForm\.responsavelId \|\| null/,
  'formulário deve enviar responsavelId no body do POST',
)
assert.match(
  client,
  /responsavelNome: \(selectedResponsavel\?\.fullName \?\? createForm\.responsavelNome\.trim\(\)\) \|\| null/,
  'formulário deve salvar nome limpo quando houver responsável selecionado',
)
assert.match(
  client,
  /list="sst-plano-acao-responsaveis"[\s\S]*<datalist id="sst-plano-acao-responsaveis">/,
  'responsável deve ter list box pesquisável via datalist',
)
assert.match(
  client,
  /<button type="submit" disabled=\{creating\}/,
  'botão Registrar deve continuar desabilitado durante creating',
)
assert.match(
  responsaveisRoute,
  /hasMinLevel\(level, ModuleLevel\.NIVEL_1\)[\s\S]*FEATURE_KEYS\.SST\.PLANO_DE_ACAO, Action\.VIEW[\s\S]*select: \{[\s\S]*id: true,[\s\S]*fullName: true,[\s\S]*email: true/,
  'endpoint de responsáveis deve exigir SST e retornar apenas dados mínimos',
)

console.log('sst action plan modal layout responsavel regression ok')
