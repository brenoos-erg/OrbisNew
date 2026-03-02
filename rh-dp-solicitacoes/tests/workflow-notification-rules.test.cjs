const assert = require('node:assert/strict')
const { resolveAppBaseUrl } = require('../src/lib/site-url.ts')

function withEnv(vars, run) {
  const backup = {}
  for (const key of Object.keys(vars)) {
    backup[key] = process.env[key]
    const value = vars[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    run()
  } finally {
    for (const key of Object.keys(vars)) {
      const value = backup[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

withEnv(
  {
    NODE_ENV: 'development',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    APP_BASE_URL: 'http://177.174.106.226:3000',
    APP_URL: '',
    NEXT_PUBLIC_APP_URL: '',
    NEXT_PUBLIC_VERCEL_URL: '',
    VERCEL_URL: '',
  },
  () => {
    assert.equal(resolveAppBaseUrl({ context: 'workflow-email' }), 'http://177.174.106.226:3000')
  },
)

withEnv(
  {
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: '',
    APP_BASE_URL: 'http://localhost:3000',
    APP_URL: 'https://orbis.company.com',
    NEXT_PUBLIC_APP_URL: '',
    NEXT_PUBLIC_VERCEL_URL: '',
    VERCEL_URL: '',
  },
  () => {
    assert.equal(resolveAppBaseUrl({ context: 'test' }), 'https://orbis.company.com')
  },
)

withEnv(
  {
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: '',
    APP_BASE_URL: '',
    APP_URL: '',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_VERCEL_URL: '',
    VERCEL_URL: '',
  },
  () => {
    assert.equal(resolveAppBaseUrl({ context: 'test' }), '')
  },
)

console.info('workflow-notification-rules.test.cjs: ok')
