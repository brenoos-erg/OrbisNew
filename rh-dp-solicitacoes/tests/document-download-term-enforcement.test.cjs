const assert = require('node:assert/strict')

const { resolveTermChallenge } = require('../src/lib/documentTermAccess')

async function run() {
  const prismaWithoutTerm = {
    documentResponsibilityTerm: { findFirst: async () => null },
    documentTermAcceptance: { findUnique: async () => null },
  }
  const noTerm = await resolveTermChallenge(prismaWithoutTerm, 'user-1')
  assert.equal(noTerm, null)

  const prismaWithAcceptedTerm = {
    documentResponsibilityTerm: {
      findFirst: async () => ({ id: 't1', title: 'Termo', content: 'Conteúdo' }),
    },
    documentTermAcceptance: {
      findUnique: async () => ({ id: 'acceptance-1' }),
    },
  }
  const accepted = await resolveTermChallenge(prismaWithAcceptedTerm, 'user-1')
  assert.equal(accepted, null)

  const prismaWithPendingTerm = {
    documentResponsibilityTerm: {
      findFirst: async () => ({ id: 't2', title: 'Termo 2', content: 'Novo conteúdo' }),
    },
    documentTermAcceptance: {
      findUnique: async () => null,
    },
  }
  const pending = await resolveTermChallenge(prismaWithPendingTerm, 'user-2')
  assert.deepEqual(pending, {
    requiresTerm: true,
    term: { id: 't2', title: 'Termo 2', content: 'Novo conteúdo' },
  })
}

run()
  .then(() => console.log('document-download-term-enforcement behavior ok'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })