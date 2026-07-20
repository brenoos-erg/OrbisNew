# Deploy no Windows Server

Para deploy no servidor Windows, execute na pasta do projeto:

```powershell
.\scripts\deploy-windows.ps1
```

O script cria backup do banco, atualiza o código, gera o Prisma Client, aplica migrations e só executa o build se todas as etapas anteriores terminarem com sucesso.

## Deploy manual

Se preferir executar manualmente, pare imediatamente quando algum comando falhar:

1. `git pull origin main`
2. `npm install`
3. `npx prisma generate --schema .\prisma\schema.prisma`
4. `npx prisma migrate deploy --schema .\prisma\schema.prisma`
5. `npm run build`
6. `node .\server-https.js`

Se necessário, configure variáveis permanentes no servidor para reduzir risco de erro de memória no build:

- `NODE_OPTIONS=--max-old-space-size=12288`
- `NEXT_PRIVATE_BUILD_WORKER_COUNT=1`

## Erro Prisma P3009

O erro `P3009` indica que existe uma migration registrada como falha na tabela `_prisma_migrations` do banco de produção. Enquanto esse registro não for resolvido, o Prisma bloqueia novas migrations.

No log abaixo, a migration com problema é `20260713120000_document_role_assignments`:

```text
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260713120000_document_role_assignments` migration started at 2026-07-13 19:51:05.891 UTC failed
```

Procedimento recomendado:

1. Confirme que o backup `.sql` foi criado e não está vazio.
2. Verifique no MySQL se as alterações dessa migration foram aplicadas total ou parcialmente.
3. Se a migration já foi aplicada corretamente no banco, marque-a como aplicada:

   ```powershell
   npx prisma migrate resolve --applied 20260713120000_document_role_assignments --schema .\prisma\schema.prisma
   ```

4. Se a migration não foi aplicada, reverta manualmente qualquer alteração parcial deixada por ela e marque-a como revertida:

   ```powershell
   npx prisma migrate resolve --rolled-back 20260713120000_document_role_assignments --schema .\prisma\schema.prisma
   ```

5. Execute novamente:

   ```powershell
   npx prisma migrate deploy --schema .\prisma\schema.prisma
   ```

Não execute `npm run build` nem suba o servidor quando `prisma migrate deploy` falhar.
