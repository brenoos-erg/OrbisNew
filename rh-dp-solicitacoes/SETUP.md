# Setup local rápido

## Requisitos
- Node.js 20+
- Docker

## 1) Subir MySQL
```bash
docker run --name orbis-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=orbis \
  -e MYSQL_USER=orbis \
  -e MYSQL_PASSWORD=orbis123 \
  -p 3306:3306 \
  -d mysql:8.4
```

## 2) Criar `.env`
```env
DATABASE_URL="mysql://orbis:orbis123@localhost:3306/orbis"
JWT_SECRET="troque-por-um-segredo-forte"
SUPERADMIN_PASSWORD="SuperAdmin@123"
```

## 3) Instalar dependências
```bash
npm install
```

### Dependências para geração de termo/PDF
```bash
npm i handlebars playwright
npx playwright install chromium
```

## 4) Rodar o projeto
```bash
SKIP_PRISMA_MIGRATE=true npm run dev
```

### O que acontece no `npm run dev`
- Lê `.env` do diretório do projeto.
- Se `SKIP_PRISMA_MIGRATE=true`, roda `prisma db push`.
- Roda `prisma db seed` automaticamente (a menos que `SKIP_PRISMA_SEED=true`).
- Sobe o Next.js.

## Super admin
- **Email:** `superadmin@ergengenharia.com.br`
- **Senha:** `SUPERADMIN_PASSWORD` do `.env`.
- **Fallback da senha (se env ausente):** `SuperAdmin@123`
## Windows: Prisma EPERM (query_engine-windows.dll.node)

Se ocorrer `EPERM: operation not permitted, rename ... node_modules\\.prisma\\client\\query_engine-windows.dll.node`:

1. Pare o `npm run dev` e qualquer processo `node.exe`.
2. Feche o VS Code (principalmente o TypeScript Server).
3. Remova a pasta `node_modules\\.prisma`.
4. Rode novamente `npx prisma generate`.
5. Se persistir, adicione exclusão no antivírus/Windows Defender para a pasta do projeto e `node_modules\\.prisma`.

No projeto, o `scripts/dev.js` roda `prisma generate` apenas antes do servidor subir (não em loop), e você pode pular com `SKIP_PRISMA_GENERATE=true`.

## Playwright/Chromium para geração de PDF

- Dependência: `playwright` (já declarada no `package.json`).
- Pós-instalação: `playwright install chromium`.
- Caso o Chromium esteja ausente, as rotas de geração de termo retornam erro claro (`409/422`) com orientação de instalação, em vez de `500` genérico.
