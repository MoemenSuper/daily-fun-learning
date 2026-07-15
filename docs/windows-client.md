# Windows notification client

## Publish

```powershell
.\scripts\publish-windows.ps1
```

This creates a self-contained, trimmed x64 client in `dist\windows-client`. No .NET runtime remains running or needs to be installed on the target machine. The installer checks for Windows App Runtime 2.2 and uses Microsoft's official runtime installer only when it is missing.

## Install

After the Cloudflare Worker is deployed, run:

```powershell
.\scripts\install-windows.ps1 `
  -BackendUrl 'https://YOUR-WORKER.workers.dev' `
  -RegistrationSecret (Read-Host 'Registration secret' -AsSecureString)
```

The installer:

- copies only published runtime files to `%LOCALAPPDATA%\DailyLearningGuide`;
- generates a 256-bit device credential;
- sends it once over HTTPS and stores it in Windows Credential Manager;
- registers a current-user task for 08:00 and two minutes after logon;
- sets a two-minute execution limit and `IgnoreNew` instance policy;
- does not request administrator rights, wake the computer, or keep a process running.

The registration secret is passed to the client in a child-only environment variable and cleared immediately. It is not written to configuration, source, Git, command-line arguments, browser storage, or a URL.

## Inspect and test

```powershell
Get-ScheduledTask -TaskName 'Daily Learning Guide' | Format-List *
Start-ScheduledTask -TaskName 'Daily Learning Guide'
& "$env:LOCALAPPDATA\DailyLearningGuide\DailyLearningGuide.exe" --test-notification
```

Test mode shows a native fixture notification without calling the delivery endpoint, so it cannot consume the real daily claim. It creates its opening link before showing the notification; clicking the notification then opens that link directly in the default browser without starting the client again.

## Reset the device credential

```powershell
.\scripts\reset-device.ps1 `
  -RegistrationSecret (Read-Host 'Registration secret' -AsSecureString)
```

This preserves the device ID and cloud learning history while replacing the local Credential Manager value and backend hash.

## Uninstall

```powershell
.\scripts\uninstall-windows.ps1
```

Uninstall removes the scheduled task, notification registration, local credential, and application directory. It deliberately leaves D1 learning history intact.
