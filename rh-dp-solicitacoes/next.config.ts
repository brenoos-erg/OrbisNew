// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ❌ remova "reactCompiler" daqui se estiver na raiz
  experimental: {
    // ✅ habilite aqui se quiser usar
    reactCompiler: true,
  },
};

export default nextConfig;
