using System.Text.Json;

namespace DailyLearningGuide;

internal sealed record ClientConfig(string BackendUrl, string DeviceId)
{
    internal static string InstallDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "DailyLearningGuide");

    internal static string ConfigPath => Path.Combine(InstallDirectory, "config.json");

    internal static ClientConfig Load()
    {
        if (!File.Exists(ConfigPath))
        {
            throw new InvalidOperationException("Daily Learning Guide is not configured. Run the installer first.");
        }

        return JsonSerializer.Deserialize(File.ReadAllText(ConfigPath), ClientJsonContext.Default.ClientConfig)
            ?? throw new InvalidOperationException("The client configuration is invalid.");
    }

    internal static void Save(ClientConfig config)
    {
        Directory.CreateDirectory(InstallDirectory);
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(config, ClientJsonContext.Default.ClientConfig));
    }
}
