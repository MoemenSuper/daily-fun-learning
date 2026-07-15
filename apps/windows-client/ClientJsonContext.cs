using System.Text.Json.Serialization;

namespace DailyLearningGuide;

[JsonSourceGenerationOptions(WriteIndented = true)]
[JsonSerializable(typeof(ClientConfig))]
[JsonSerializable(typeof(RegisterRequest))]
[JsonSerializable(typeof(DeliveryCheckRequest))]
[JsonSerializable(typeof(DeliveryResult))]
[JsonSerializable(typeof(OpeningTokenResult))]
internal partial class ClientJsonContext : JsonSerializerContext;
