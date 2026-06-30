const assert = require('assert'); const fs = require('fs');
const page = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx','utf8');
assert(page.includes('handleCargoChange'));
assert(page.includes('indexadorCargo'));
assert(page.includes('documentoCargoId'));
assert(page.includes('Este cargo não possui documento oficial anexado.'));
console.log('position-rq063-prefill ok');
