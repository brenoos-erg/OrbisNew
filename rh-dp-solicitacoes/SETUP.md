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
