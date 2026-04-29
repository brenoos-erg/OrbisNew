# Deploy no Windows Server

Para deploy no servidor Windows, execute na pasta do projeto:

1. `git pull origin main`
2. `npm install`
3. `npm run build`
4. `npm run start`

Se necessário, configure variáveis permanentes no servidor para reduzir risco de erro de memória no build:

- `NODE_OPTIONS=--max-old-space-size=12288`
- `NEXT_PRIVATE_BUILD_WORKER_COUNT=1`
