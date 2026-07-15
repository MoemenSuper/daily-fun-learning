[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://')]
    [string]$BackendUrl,

    [Parameter(Mandatory)]
    [Security.SecureString]$RegistrationSecret,

    [string]$ClientSource = (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\windows-client'),

    [switch]$ResetDevice
)

$ErrorActionPreference = 'Stop'
$taskName = 'Daily Learning Guide'
$installDirectory = Join-Path $env:LOCALAPPDATA 'DailyLearningGuide'
$clientExecutable = Join-Path $installDirectory 'DailyLearningGuide.exe'

if (-not (Test-Path -LiteralPath (Join-Path $ClientSource 'DailyLearningGuide.exe'))) {
    throw "Published client files were not found at $ClientSource. Run scripts\publish-windows.ps1 first."
}

$runtimeInstalled = Get-AppxPackage -Name 'MicrosoftCorporationII.WinAppRuntime.Main.2' -ErrorAction SilentlyContinue |
    Where-Object { $_.Architecture -eq 'X64' -and $_.Version -ge [version]'2.2.0.0' }
if (-not $runtimeInstalled) {
    $runtimeInstaller = Join-Path $env:TEMP 'WindowsAppRuntimeInstall-2.2-x64.exe'
    Invoke-WebRequest -Uri 'https://aka.ms/windowsappsdk/2.2/2.2.0/windowsappruntimeinstall-x64.exe' -OutFile $runtimeInstaller
    $runtimeProcess = Start-Process -FilePath $runtimeInstaller -ArgumentList '--quiet' -WindowStyle Hidden -Wait -PassThru
    Remove-Item -LiteralPath $runtimeInstaller -Force -ErrorAction SilentlyContinue
    if ($runtimeProcess.ExitCode -ne 0) {
        throw "Windows App Runtime installation failed with exit code $($runtimeProcess.ExitCode)."
    }
}

$runningClient = Get-Process -Name 'DailyLearningGuide' -ErrorAction SilentlyContinue
if ($runningClient) { throw 'The Daily Learning Guide client is still running. Wait a few seconds and run the installer again.' }

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -Path (Join-Path $ClientSource '*') -Destination $installDirectory -Recurse -Force

$plainSecret = [Net.NetworkCredential]::new('', $RegistrationSecret).Password
try {
    $registration = [Diagnostics.ProcessStartInfo]::new()
    $registration.FileName = $clientExecutable
    $registration.Arguments = if ($ResetDevice) { '--reset-device' } else { '--register-device' }
    $registration.UseShellExecute = $false
    $registration.CreateNoWindow = $true
    $registration.Environment['DLG_BACKEND_URL'] = $BackendUrl.TrimEnd('/')
    $registration.Environment['DLG_REGISTRATION_SECRET'] = $plainSecret
    $registrationProcess = [Diagnostics.Process]::Start($registration)
    if (-not $registrationProcess.WaitForExit(30000)) {
        $registrationProcess.Kill()
        throw 'Device registration timed out.'
    }
    if ($registrationProcess.ExitCode -ne 0) {
        throw "Device registration failed. See $installDirectory\client-errors.log"
    }
} finally {
    $plainSecret = $null
}

$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $clientExecutable
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At '08:00'
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$logonTrigger.Delay = 'PT2M'
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger @($dailyTrigger, $logonTrigger) `
    -Settings $settings `
    -Principal $principal `
    -Description 'Checks once for a due learning tip, shows a notification when needed, and exits.' `
    -Force | Out-Null

Write-Host "Installed Daily Learning Guide for $currentUser."
Write-Host "Scheduled task: $taskName (daily at 08:00 and two minutes after logon)"

