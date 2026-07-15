[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [Security.SecureString]$RegistrationSecret
)

$ErrorActionPreference = 'Stop'
$installDirectory = Join-Path $env:LOCALAPPDATA 'DailyLearningGuide'
$clientExecutable = Join-Path $installDirectory 'DailyLearningGuide.exe'
$configPath = Join-Path $installDirectory 'config.json'
if (-not (Test-Path -LiteralPath $clientExecutable) -or -not (Test-Path -LiteralPath $configPath)) {
    throw 'Daily Learning Guide is not installed.'
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$plainSecret = [Net.NetworkCredential]::new('', $RegistrationSecret).Password
try {
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $clientExecutable
    $startInfo.Arguments = '--reset-device'
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.Environment['DLG_BACKEND_URL'] = $config.BackendUrl
    $startInfo.Environment['DLG_REGISTRATION_SECRET'] = $plainSecret
    $process = [Diagnostics.Process]::Start($startInfo)
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "Device reset failed. See $installDirectory\client-errors.log" }
} finally {
    $plainSecret = $null
}

Write-Host 'The device credential was replaced in Windows Credential Manager and on the backend.'

