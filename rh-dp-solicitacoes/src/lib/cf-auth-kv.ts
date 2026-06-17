// Cloudflare KV helpers

export function getAuthRateKV() {
  const context = getRequestContext();
  const kv = context.env.AUTH_RATE_KV || globalThis.__AUTH_RATE_KV_MOCK;
  if (!kv) {
    throw new Error('AUTH_RATE_KV is not bound in production');
  }
  return kv;
}
