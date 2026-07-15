using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace DailyLearningGuide;

internal sealed class LearningApiClient(ClientConfig config)
{
    private static readonly HttpClient HttpClient = new() { Timeout = TimeSpan.FromSeconds(15) };

    internal async Task RegisterAsync(string credential, string registrationSecret, bool reset)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BuildUrl("/api/devices/register"));
        request.Headers.Authorization = new("Bearer", registrationSecret);
        request.Content = JsonContent.Create(
            new RegisterRequest(config.DeviceId, credential, reset),
            ClientJsonContext.Default.RegisterRequest);
        using var response = await HttpClient.SendAsync(request);
        await EnsureSuccess(response, "Device registration failed.");
    }

    internal async Task<DeliveryResult> CheckDeliveryAsync()
    {
        using var request = CreateDeviceRequest(HttpMethod.Post, "/api/delivery/check");
        request.Content = JsonContent.Create(
            new DeliveryCheckRequest(config.DeviceId),
            ClientJsonContext.Default.DeliveryCheckRequest);
        using var response = await HttpClient.SendAsync(request);
        await EnsureSuccess(response, "The daily lesson check failed.");
        return await response.Content.ReadFromJsonAsync(ClientJsonContext.Default.DeliveryResult)
            ?? throw new InvalidOperationException("The delivery response was empty.");
    }

    internal async Task<string> CreateOpeningUrlAsync()
    {
        using var request = CreateDeviceRequest(HttpMethod.Post, "/api/opening-tokens");
        using var response = await HttpClient.SendAsync(request);
        await EnsureSuccess(response, "The lesson opening link could not be created.");
        var result = await response.Content.ReadFromJsonAsync(ClientJsonContext.Default.OpeningTokenResult);
        return result?.Url ?? throw new InvalidOperationException("The opening-link response was empty.");
    }

    private HttpRequestMessage CreateDeviceRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, BuildUrl(path));
        request.Headers.TryAddWithoutValidation(
            "Authorization",
            $"Device {config.DeviceId}:{CredentialStore.Read()}");
        return request;
    }

    private Uri BuildUrl(string path) => new(new Uri(config.BackendUrl.TrimEnd('/') + "/"), path.TrimStart('/'));

    private static async Task EnsureSuccess(HttpResponseMessage response, string message)
    {
        if (response.IsSuccessStatusCode) return;
        var detail = await response.Content.ReadAsStringAsync();
        throw new HttpRequestException($"{message} HTTP {(int)response.StatusCode}: {detail}");
    }
}

internal sealed record DeliveryResult(
    [property: JsonPropertyName("shouldNotify")] bool ShouldNotify,
    [property: JsonPropertyName("notification")] NotificationCopy? Notification);

internal sealed record NotificationCopy(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("body")] string Body);

internal sealed record OpeningTokenResult([property: JsonPropertyName("url")] string Url);

internal sealed record RegisterRequest(
    [property: JsonPropertyName("deviceId")] string DeviceId,
    [property: JsonPropertyName("credential")] string Credential,
    [property: JsonPropertyName("reset")] bool Reset);

internal sealed record DeliveryCheckRequest([property: JsonPropertyName("deviceId")] string DeviceId);
