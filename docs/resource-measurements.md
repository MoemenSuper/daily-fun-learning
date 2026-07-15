# Windows client resource measurements

Measured on Windows 11 x64 build 26200 using the Release, self-contained, trimmed .NET 10 build and Windows App SDK 2.2.

| Measurement | Result |
| --- | ---: |
| Published client footprint | 22.63 MiB across 69 files |
| Native notification test runtime | 7.26 seconds, including opening-link creation |
| Native notification test peak working set | 34.97 MiB |
| Authenticated backend check runtime | 4.73 seconds |
| Authenticated backend check peak working set | 47.46 MiB |
| Client processes after either run | 0 |
| Daily-check JSON request body | 33 bytes |
| Due-notification JSON response | Varies; includes a one-use opening URL |
| Duplicate-check JSON response | 55 bytes |

New notifications contain a one-use HTTPS opening link and launch it directly in the default browser, avoiding a second client cold start and network request after the click. The app lifecycle activation path remains available for older notifications. Network requests have a 15-second timeout, and the process does not remain alive after a check or legacy notification activation.

The first umbrella Windows App SDK build measured 154.38 MiB because it included unused WinUI, DirectML, ONNX, widgets, and AI components. Referencing only the official Foundation and Runtime packages reduced the published footprint to 22.64 MiB while preserving `Microsoft.Windows.AppNotifications.AppNotificationManager` and the cold-start lifecycle projection.

These figures measure the application files copied to `%LOCALAPPDATA%\DailyLearningGuide`. The shared Windows App Runtime is installed once for Windows applications and is not duplicated inside the application directory.
