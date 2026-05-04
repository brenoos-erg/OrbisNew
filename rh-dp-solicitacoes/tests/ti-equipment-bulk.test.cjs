const assert = require('assert')
const { normalizeStatus, previewBulk } = require('../src/lib/tiEquipmentBulk.ts')

assert.equal(normalizeStatus('em estoque','ASSIGNED'),'IN_STOCK')
assert.equal(normalizeStatus('manutenção','IN_STOCK'),'MAINTENANCE')

const prisma = {
  tiEquipment: { findMany: async ({ where }) => (where.patrimonio ? [{ patrimonio: 'PAT-1' }] : [{ serialNumber: 'SER-1' }]) },
  costCenter: { findUnique: async () => ({ id: 'cc1' }) },
  user: { findMany: async () => [] },
}

;(async () => {
  const preview = await previewBulk(prisma, { common: { costCenterId:'cc1', category:'NOTEBOOK', status:'IN_STOCK', source:'MANUAL' }, rows:[{ lineNumber:1, patrimonio:'PAT-1', serialNumber:'SER-1' },{ lineNumber:2, patrimonio:'PAT-1' }] })
  assert.ok(preview.rows[0].errors.some((e)=>e.includes('já existente')))
  assert.ok(preview.rows[1].errors.some((e)=>e.includes('duplicado')))
  console.info('ti-equipment-bulk.test.cjs: ok')
})().catch((e)=>{ console.error(e); process.exit(1) })
