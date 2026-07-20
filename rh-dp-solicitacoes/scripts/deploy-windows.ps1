param(
  [string]$DatabaseName = "orbis",
  [string]$BackupDirectory = "C:\Backups\Orbis",
  [string]$SchemaPath = ".\prisma\schema.prisma",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Command

  if ($LASTEXITCODE -ne 0) {
    throw "Etapa '$Name' falhou com código $LASTEXITCODE. Deploy cancelado."
  }
}

New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDirectory "${DatabaseName}_backup_${timestamp}.sql"

Invoke-Step "Criar backup do banco" {
  mysqldump --databases $DatabaseName --result-file="$backupFile"
}

if (!(Test-Path $backupFile) -or ((Get-Item $backupFile).Length -eq 0)) {
  throw "Backup do banco falhou. Deploy cancelado."
}

Write-Host "Backup criado com sucesso em: $backupFile"

Invoke-Step "Atualizar código" {
  git pull origin $Branch
}

Invoke-Step "Gerar Prisma Client" {
  npx prisma generate --schema $SchemaPath
}

Invoke-Step "Aplicar migrations do Prisma" {
  npx prisma migrate deploy --schema $SchemaPath
}

Invoke-Step "Build de produção" {
  npm run build
}

Write-Host ""
Write-Host "Deploy concluído. Iniciando servidor HTTPS..."
node .\server-https.js
