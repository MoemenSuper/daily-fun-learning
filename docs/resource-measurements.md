# Windows client resource measurements

Measured on Windows 11 x64 build 26200 using the Release, self-contained, trimmed .NET 10 build and Windows App SDK 2.2.

| Measurement | Result |
| --- | ---: |
| Published client footprint | 22.60 MiB across 68 files |
| Native notification test runtime | 3.49 seconds |
| Native notification test peak working set | 34.97 MiB |
| Authenticated backend check runtime | 4.73 seconds |
| Authenticated backend check peak working set | 47.46 MiB |
| Client processes after either run | 0 |
| Daily-check JSON request body | 33 bytes |
| Due-notification JSON response | 227 bytes |
| Duplicate-check JSON response | 55 bytes |

Cold-start notification data is read directly from the Windows app lifecycle API, and network requests have a 15-second timeout. The process does not remain alive after a check or notification activation.

The first umbrella Windows App SDK build measured 154.38 MiB because it included unused WinUI, DirectML, ONNX, widgets, and AI components. Referencing only the official Foundation and Runtime packages reduced the published footprint to 22.64 MiB while preserving `Microsoft.Windows.AppNotifications.AppNotificationManager` and the cold-start lifecycle projection.

These figures measure the application files copied to `%LOCALAPPDATA%\DailyLearningGuide`. The shared Windows App Runtime is installed once for Windows applications and is not duplicated inside the application directory.
