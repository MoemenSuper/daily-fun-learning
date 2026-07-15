using System.Diagnostics;
using System.Security.Cryptography;
using Microsoft.Windows.AppLifecycle;
using Microsoft.Windows.AppNotifications;

namespace DailyLearningGuide;

internal static class Program
{
    private const string NotificationActivationArgument = "----AppNotificationActivated:";
    private static readonly bool DiagnosticEnabled = Environment.GetEnvironmentVariable("DLG_DIAGNOSTIC") == "1";

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            Trace($"start args={string.Join('|', args)}");
            var isNotificationActivation = args.Contains(NotificationActivationArgument);
            using var mutex = new Mutex(true, "Local\\DailyLearningGuide.Client", out var ownsMutex);
            Trace($"mutex owns={ownsMutex}");
            if (!ownsMutex && isNotificationActivation)
            {
                ownsMutex = mutex.WaitOne(TimeSpan.FromSeconds(5));
                Trace($"mutex acquired after wait={ownsMutex}");
            }
            if (!ownsMutex) return 0;

            if (args.Contains("--register-device")) return RegisterDevice(reset: false);
            if (args.Contains("--reset-device")) return RegisterDevice(reset: true);
            if (args.Contains("--remove-credential")) { CredentialStore.Delete(); return 0; }

            Trace("getting manager");
            var manager = AppNotificationManager.Default;
            manager.NotificationInvoked += OnNotificationInvoked;
            Trace("registering");
            manager.Register();
            Trace("registered");

            if (isNotificationActivation)
            {
                var activation = AppInstance.GetCurrent().GetActivatedEventArgs();
                if (
                    activation.Kind != ExtendedActivationKind.AppNotification ||
                    activation.Data is not AppNotificationActivatedEventArgs notificationArgs
                )
                {
                    throw new InvalidOperationException("Windows launched the notification activator without app-notification data.");
                }
                HandleNotificationInvocation(notificationArgs);
                manager.Unregister();
                return 0;
            }

            if (args.Contains("--unregister-notifications"))
            {
                manager.UnregisterAll();
                return 0;
            }

            if (args.Contains("--test-notification"))
            {
                Trace("showing test notification");
                var openUrl = new LearningApiClient(ClientConfig.Load()).CreateOpeningUrlAsync().GetAwaiter().GetResult();
                ShowNotification(
                    manager,
                    "Daily Learning Guide test",
                    "Notifications are working. This test did not change lesson delivery state.",
                    openUrl);
                Trace("shown; unregistering");
                manager.Unregister();
                Trace("unregistered");
                return 0;
            }

            var result = new LearningApiClient(ClientConfig.Load()).CheckDeliveryAsync().GetAwaiter().GetResult();
            if (result.ShouldNotify && result.Notification is not null)
            {
                ShowNotification(
                    manager,
                    result.Notification.Title,
                    result.Notification.Body,
                    result.Notification.OpenUrl);
            }
            manager.Unregister();
            return 0;
        }
        catch (Exception error)
        {
            WriteError(error);
            return 1;
        }
    }

    private static int RegisterDevice(bool reset)
    {
        var backendUrl = Environment.GetEnvironmentVariable("DLG_BACKEND_URL")?.Trim();
        var registrationSecret = Environment.GetEnvironmentVariable("DLG_REGISTRATION_SECRET")?.Trim();
        Environment.SetEnvironmentVariable("DLG_BACKEND_URL", null);
        Environment.SetEnvironmentVariable("DLG_REGISTRATION_SECRET", null);
        if (!Uri.TryCreate(backendUrl, UriKind.Absolute, out _) || string.IsNullOrWhiteSpace(registrationSecret))
        {
            throw new InvalidOperationException("Registration requires temporary backend and registration-secret environment variables.");
        }

        var existing = File.Exists(ClientConfig.ConfigPath) ? ClientConfig.Load() : null;
        var config = new ClientConfig(backendUrl, existing?.DeviceId ?? $"windows-{Guid.NewGuid():N}");
        var credential = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        new LearningApiClient(config).RegisterAsync(credential, registrationSecret, reset).GetAwaiter().GetResult();
        CredentialStore.Write(config.DeviceId, credential);
        ClientConfig.Save(config);
        return 0;
    }

    private static void OnNotificationInvoked(AppNotificationManager sender, AppNotificationActivatedEventArgs args)
    {
        try
        {
            HandleNotificationInvocation(args);
        }
        catch (Exception error)
        {
            WriteError(error);
        }
    }

    private static void HandleNotificationInvocation(AppNotificationActivatedEventArgs args)
    {
        Trace($"notification invoked args={args.Argument}");
        var values = ParseArguments(args.Argument);
        if (values.GetValueOrDefault("action") != "open") return;
        var url = new LearningApiClient(ClientConfig.Load()).CreateOpeningUrlAsync().GetAwaiter().GetResult();
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static Dictionary<string, string> ParseArguments(string arguments) => arguments
        .Split('&', StringSplitOptions.RemoveEmptyEntries)
        .Select(part => part.Split('=', 2))
        .Where(parts => parts.Length == 2)
        .ToDictionary(parts => Uri.UnescapeDataString(parts[0]), parts => Uri.UnescapeDataString(parts[1]));

    private static void ShowNotification(AppNotificationManager manager, string title, string body, string openUrl)
    {
        var notification = new AppNotification(
            $"<toast launch=\"{EscapeXml(openUrl)}\" activationType=\"protocol\">" +
            "<visual><binding template=\"ToastGeneric\">" +
            $"<text>{EscapeXml(title)}</text><text>{EscapeXml(body)}</text>" +
            "</binding></visual><audio silent=\"true\"/></toast>");
        notification.ExpiresOnReboot = true;
        manager.Show(notification);
    }

    private static string EscapeXml(string value) => value
        .Replace("&", "&amp;")
        .Replace("\"", "&quot;")
        .Replace("'", "&apos;")
        .Replace("<", "&lt;")
        .Replace(">", "&gt;");

    private static void WriteError(Exception error)
    {
        Directory.CreateDirectory(ClientConfig.InstallDirectory);
        File.AppendAllText(
            Path.Combine(ClientConfig.InstallDirectory, "client-errors.log"),
            $"{DateTimeOffset.Now:O} {error}\n");
    }

    private static void Trace(string message)
    {
        if (!DiagnosticEnabled) return;
        Directory.CreateDirectory(ClientConfig.InstallDirectory);
        File.AppendAllText(
            Path.Combine(ClientConfig.InstallDirectory, "diagnostic.log"),
            $"{DateTimeOffset.Now:O} pid={Environment.ProcessId} {message}\n");
    }
}
