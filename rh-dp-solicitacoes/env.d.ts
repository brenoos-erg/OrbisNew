// env.d.ts
// Variáveis de ambiente esperadas:
// - NEXT_PUBLIC_SITE_URL: URL pública do app (dev: http://localhost:3000; prod: https://sgi-plus.vercel.app)
// - NEXT_PUBLIC_SUPABASE_URL: URL do projeto Supabase
// - NEXT_PUBLIC_SUPABASE_ANON_KEY: chave pública (anon) do Supabase
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SITE_URL: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    DATABASE_URL: string;
    // adicione outras que você usa
    CRON_SECRET?: string
  }
}