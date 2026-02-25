# Teste rápido do fluxo de autenticação (primeiro acesso)

1. Aplique migrações e gere cliente Prisma:

```bash
npm run prisma:generate
```

2. Rode o script automatizado de verificação do fluxo completo:

```bash
node scripts/test-auth-first-access.mjs
```

Esse script valida:
- login de usuário sem senha retorna `reason: "NO_PASSWORD"`;
- `request-password-reset` gera token de reset no banco;
- `reset-password` atualiza senha e limpa token;
- login após reset retorna `200` e envia cookie `app_auth`.

3. (Opcional) Suba o app localmente para validar UI:

```bash
npm run dev
```

4. Validação manual em navegador:
- acesse `/login`;
- tente autenticar com usuário sem senha;
- confirme mensagem de primeiro acesso + bloco “Esqueci minha senha” aberto automaticamente;
- gere recuperação;
- abra link `/primeiro-acesso?token=...` recebido;
- defina nova senha e confirme redirecionamento para `next`.