const assert = require('assert'); const fs = require('fs');
const page = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx','utf8');
assert(page.includes('cargoSnapshot'), 'RQ_063 deve manter cargoSnapshot legado no payload quando já existir');
assert(page.includes("cargoId: extras.cargoId ?? ''"), 'RQ_063 deve manter cargoId apenas como compatibilidade opcional');
assert(!page.includes('positionId: position.id'), 'RQ_063 não deve depender de snapshot gerado a partir de cargo cadastrado');
console.log('position-document-snapshot ok');
