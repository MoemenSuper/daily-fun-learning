[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [Security.SecureString]$RegistrationSecret
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$workerDirectory = Join-Path $repoRoot 'apps\worker'
$configPath = Join-Path $workerDirectory 'wrangler.jsonc'
$databaseName = 'daily-learning-guide'

Push-Location $workerDirectory
try {
    $whoAmI = & npx wrangler whoami --json
    if ($LASTEXITCODE -ne 0) { throw 'Wrangler is not authenticated. Run npx wrangler login first.' }

    $databases = (& npx wrangler d1 list --json | ConvertFrom-Json)
    $database = $databases | Where-Object { $_.name -eq $databaseName } | Select-Object -First 1
    if (-not $database) {
        & npx wrangler d1 create $databaseName --location eeur --binding DB --update-config
        if ($LASTEXITCODE -ne 0) { throw 'D1 database creation failed.' }
    } else {
        $config = Get-Content -LiteralPath $configPath -Raw
        if ($config -match '"database_id"\s*:\s*"local"') {
            $replacement = '"database_id": "' + $database.uuid + '"'
            $config = [regex]::Replace($config, '"database_id"\s*:\s*"local"', $replacement, 1)
            [IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))
        }
    }

    & npm run build --workspace '@daily-learning/web'
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    & npx wrangler d1 migrations apply $databaseName --remote
    if ($LASTEXITCODE -ne 0) { throw 'Remote D1 migration failed.' }
    & npx wrangler d1 execute $databaseName --remote --file '../../scripts/seed.sql'
    if ($LASTEXITCODE -ne 0) { throw 'Remote D1 seed failed.' }
    & npx wrangler deploy
    if ($LASTEXITCODE -ne 0) { throw 'Worker deployment failed.' }

    $plainSecret = [Net.NetworkCredential]::new('', $RegistrationSecret).Password
    try {
        $plainSecret | & npx wrangler secret put DEVICE_REGISTRATION_SECRET
        if ($LASTEXITCODE -ne 0) { throw 'Registration secret upload failed.' }
    } finally {
        $plainSecret = $null
    }
} finally {
    Pop-Location
}

Write-Host 'Cloudflare deployment completed. Copy the workers.dev URL from the deploy output for Windows installation.'
