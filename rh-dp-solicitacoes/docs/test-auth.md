# Teste rápido do fluxo de autenticação (primeiro acesso)

1. Garanta que o arquivo `.env` esteja configurado (principalmente `DATABASE_URL`).

2. Aplique migrações e gere cliente Prisma:

```bash
npm run prisma:generate
```

3. Suba a aplicação localmente (necessário para os endpoints `/api/auth/*`):

```bash
npm run dev
```

4. Em outro terminal, rode o script automatizado de verificação do fluxo completo:

```bash
node scripts/test-auth-first-access.mjs
```

> Dica: para apontar para outra URL, use `BASE_URL`.
>
> Exemplo: `BASE_URL=http://127.0.0.1:3001 node scripts/test-auth-first-access.mjs`

Esse script valida:
- login de usuário sem senha retorna `reason: "NO_PASSWORD"`;
- `request-password-reset` gera token de reset no banco;
- `reset-password` atualiza senha e limpa token;
- login após reset retorna `200` e envia cookie `app_auth`.

5. Validação manual em navegador (opcional):
- acesse `/login`;
- tente autenticar com usuário sem senha;
- confirme mensagem de primeiro acesso + bloco “Esqueci minha senha” aberto automaticamente;
- gere recuperação;
- abra link `/primeiro-acesso?token=...` recebido;
- defina nova senha e confirme redirecionamento para `next`.