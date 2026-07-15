[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot 'apps\windows-client\DailyLearningGuide.Client.csproj'
$output = Join-Path $repoRoot 'dist\windows-client'
$perUserDotnet = Join-Path $env:LOCALAPPDATA 'Microsoft\dotnet\dotnet.exe'
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $perUserDotnet) {
    $dotnetPath = $perUserDotnet
} elseif ($dotnet) {
    $dotnetPath = $dotnet.Source
} else {
    throw '.NET 10 SDK was not found. Install it before publishing the Windows client.'
}

if (Test-Path -LiteralPath $output) {
    $resolvedOutput = (Resolve-Path -LiteralPath $output).Path
    if (-not $resolvedOutput.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar)) {
        throw 'The publish output escaped the repository.'
    }
    Remove-Item -LiteralPath $resolvedOutput -Recurse -Force
}

& $dotnetPath publish $project -c Release -o $output
if ($LASTEXITCODE -ne 0) { throw "Client publish failed with exit code $LASTEXITCODE." }

$files = Get-ChildItem -LiteralPath $output -File -Recurse
$sizeMiB = [math]::Round((($files | Measure-Object Length -Sum).Sum) / 1MB, 2)
Write-Host "Published $($files.Count) files ($sizeMiB MiB) to $output"
