[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$workerDirectory = Join-Path $repoRoot 'apps\worker'
$backupDirectory = Join-Path $repoRoot 'backups'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = Join-Path $backupDirectory "daily-learning-guide-$timestamp.sql"

Push-Location $workerDirectory
try {
    & npx.cmd wrangler d1 export daily-learning-guide --remote --output $output --skip-confirmation
    if ($LASTEXITCODE -ne 0) { throw 'D1 export failed.' }
} finally {
    Pop-Location
}

Write-Host "D1 backup written to $output"
