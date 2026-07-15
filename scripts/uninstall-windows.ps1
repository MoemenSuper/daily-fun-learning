[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'Daily Learning Guide'
$installDirectory = Join-Path $env:LOCALAPPDATA 'DailyLearningGuide'
$clientExecutable = Join-Path $installDirectory 'DailyLearningGuide.exe'

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

if (Test-Path -LiteralPath $clientExecutable) {
    Start-Process -FilePath $clientExecutable -ArgumentList '--unregister-notifications' -WindowStyle Hidden -Wait
    Start-Process -FilePath $clientExecutable -ArgumentList '--remove-credential' -WindowStyle Hidden -Wait
}

if (Test-Path -LiteralPath $installDirectory) {
    $resolved = (Resolve-Path -LiteralPath $installDirectory).Path
    $expected = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'DailyLearningGuide'))
    if ($resolved -ne $expected) { throw 'Refusing to remove an unexpected directory.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}

Write-Host 'Removed the scheduled task, client files, notification registration, and local credential.'
Write-Host 'Cloud lesson history was not deleted.'
