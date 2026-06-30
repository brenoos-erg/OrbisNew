const assert = require('assert'); const fs = require('fs');
const page = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx','utf8');
assert(page.includes('cargoSnapshot'));
assert(page.includes('positionId: position.id'));
assert(page.includes('documentId: (position.latestDocument ?? position.documentoAtual)?.id'));
console.log('position-document-snapshot ok');
