const fs = require('fs')
const assert = require('assert')

const source = fs.readFileSync('src/app/dashboard/rh/cargos/CargoFormModal.tsx', 'utf8')

assert(source.includes('fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4'), 'container externo deve ter p-4')
assert(source.includes('h-[calc(100vh-2rem)]') || source.includes('max-h-[calc(100vh-2rem)]'), 'modal deve respeitar altura da viewport')
assert(/className="[^"]*shrink-0[^"]*items-center justify-between border-b p-6/.test(source), 'cabeçalho deve ter shrink-0')
assert(/<fieldset[\s\S]*className="[^"]*min-h-0[^"]*flex-1[^"]*overflow-y-auto/.test(source), 'fieldset deve ter min-h-0, flex-1 e overflow-y-auto')
assert(/className="[^"]*shrink-0[^"]*items-center justify-between gap-3 border-t/.test(source), 'rodapé deve ter shrink-0')
assert(!source.includes('sticky bottom-0 flex items-center justify-between gap-3 border-t'), 'rodapé não deve depender apenas de sticky bottom-0')

console.log('rh-position-modal-scroll-static: ok')
