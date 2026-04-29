# Deploy em Windows Server (Next.js)

Este projeto pode consumir muita memória na etapa `Running TypeScript` do `next build`.
Para mitigar, use build com heap ampliado e 1 worker.

## 1) Pré-requisitos

- Node.js LTS instalado
- Dependências instaladas (`npm ci`)
- MySQL em execução

## 2) Iniciar MySQL

Use o método do seu ambiente (serviço do Windows, Docker, etc.).
Exemplo PowerShell (serviço):

```powershell
Start-Service MySQL80
```

## 3) Rodar migrations

```powershell
npm run prisma:deploy
```

## 4) Build de produção (recomendado)

```powershell
npm run build:prod
```

Este comando aplica:
- `NODE_OPTIONS=--max-old-space-size=12288`
- `NEXT_PRIVATE_BUILD_WORKER_COUNT=1`

## 5) Fallback sem Turbopack (se ainda houver OOM)

```powershell
npm run build:webpack
```

## 6) Validar que build finalizou

```powershell
Test-Path .next\BUILD_ID
```

O resultado deve ser `True`.

## 7) Subir aplicação

```powershell
npm run start
```
