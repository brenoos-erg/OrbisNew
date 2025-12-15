# 🧭 Projeto RH-DP Solicitações — Documentação de Setup

## 🧩 Objetivo
Sistema web para comunicação entre **Recursos Humanos (RH)** e **Departamento Pessoal (DP)**, permitindo a criação, acompanhamento e resposta de solicitações internas.

---

## 🚀 Etapas de Configuração

### 1. Criação do Projeto Next.js
```bash
npx create-next-app@latest rh-dp-solicitacoes
cd rh-dp-solicitacoes
```

---

### 2. Estrutura de Pastas
```
rh-dp-solicitacoes/
│
├── prisma/
│   └── schema.prisma        # Estrutura do banco (Prisma ORM)
│
├── src/
│   ├── app/                 # Páginas e rotas (Next.js 14+ App Router)
│   ├── components/          # Componentes reutilizáveis
│   ├── lib/                 # Conexões (ex: prisma.ts, supabase.ts)
│   ├── services/            # Regras de negócio (integrações)
│   └── styles/              # Estilos globais
│
├── .env                     # Variáveis de ambiente
└── package.json
```

---

### 3. Instalação das Dependências
```bash
npm install @prisma/client prisma
npm install @supabase/supabase-js
npm install next react react-dom
```

---

### 4. Inicialização do Prisma
```bash
npx prisma init
```

Isso cria o diretório `/prisma` e o arquivo `schema.prisma`.

---

### 5. Configuração do Banco (Supabase)
Banco de dados hospedado no **Supabase**, que usa PostgreSQL.

#### `.env` Final (funcional)
```env
# Banco de dados Supabase (use URL DO POOL para Vercel/serverless)
DATABASE_URL=postgresql://postgres:Xmfobk5332%21@aws-0-sa-east-1.pooler.supabase.net:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1

# URL direta (para migrações locais ou ambientes com IPv6 liberado)
DIRECT_DATABASE_URL=postgresql://postgres:Xmfobk5332%21@db.wgwgdghkecnekqhseavy.supabase.co:5432/postgres?sslmode=require

# Supabase API
NEXT_PUBLIC_SUPABASE_URL=https://wgwgdghkecnekqhseavy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnd2dkZ2hrZWNuZWtxaHNlYXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4OTk5OTMsImV4cCI6MjA2NzQ3NTk5M30.Ge3d63q1p0a1rX4G1E4fKAhT8fDldDxON1_CKIUTR74
```

> 💡 Observação: a senha contém `!`, que foi escapado para `%21`.
> Em produção (Vercel) use a URL de *pooling* (`aws-0-...pooler.supabase.net`) para evitar falhas de conexão em ambientes sem IPv6.

---

### 6. Configuração do Prisma (`prisma/schema.prisma`)
*(... conteúdo completo conforme definido acima ...)*

---

### 7. Problemas e Soluções
| Erro | Causa | Solução |
|------|--------|----------|
| `P1001: Can't reach database server` | DNS não resolvia IPv6 | Instalado **Cloudflare WARP** |
| `P1001` no Vercel / serverless | Conexão direta exige IPv6 e esgota conexões | Usar string de pooling do Supabase (`aws-0-...pooler.supabase.net:6543`) em `DATABASE_URL` e manter `DIRECT_DATABASE_URL` apenas para migrações locais |
| `P1001` durante `npm run dev` em ambientes sem acesso à internet | Falha ao aplicar migrações antes de subir o Next.js | Rode `SKIP_PRISMA_MIGRATE=true npm run dev` para iniciar o servidor sem aplicar migrações (as operações de banco continuarão indisponíveis). Também é possível colocar `SKIP_PRISMA_MIGRATE=true` no `.env`, já que o script de dev agora carrega esse arquivo automaticamente. Para evitar erros de sincronização de sessão quando o banco estiver inacessível, defina também `SKIP_PRISMA_DB=true`. |
| `Validation Error Count` no schema | Comentários com `#` | Trocado para `//` |
| `Enum value definition` inválido | Prisma não aceita `#` | Corrigido comentários |
| Pooler `.net` não resolvia | Infra Supabase sem IPv4 | Usado host direto `.co` via IPv6 |

---

### 8. Cloudflare WARP
Instalado e ativado para fornecer **IPv6 e DNS global**.  
Permitiu que `db.wgwgdghkecnekqhseavy.supabase.co` resolvesse e a porta 5432 ficasse acessível.

Teste bem-sucedido:
```powershell
nslookup db.wgwgdghkecnekqhseavy.supabase.co
Test-NetConnection db.wgwgdghkecnekqhseavy.supabase.co -Port 5432
# Resultado: TcpTestSucceeded : True ✅
```

---

### 9. Migração do Banco
Após validação, rodado:
```bash
npx prisma migrate dev --name init
```

Criação de tabelas confirmada no painel **Supabase → Database → Table Editor**.

---

### 10. Teste de Inserção (via Prisma)
Arquivo `test-prisma.js` criado para validar inserção no banco.

---

## ✅ Status Atual
| Item | Situação |
|------|-----------|
| Prisma configurado | ✅ |
| Conexão com Supabase | ✅ (via IPv6 + WARP) |
| Migrações aplicadas | ✅ |
| Inserção de teste | ✅ |
| Infra mínima funcional | ✅ |

---

## 📚 Próximos Passos
- [ ] Criar API routes para CRUD (`/api/users`, `/api/solicitacoes`)
- [ ] Implementar autenticação com Supabase Auth
- [ ] Criar dashboard Next.js com controle por `Role`
- [ ] Configurar deploy (Vercel + variável DATABASE_URL)

---

**Autor:** Breno Sousa  
**Data:** 05/11/2025  
**Ambiente:** Node 20 + Next.js + Prisma + Supabase + WARP IPv6
