using System.Text.Json;

namespace MiraDeviceAgent;

/// <summary>Envelope-Format v1, siehe docs/device-control-gateway-spec.md.</summary>
public sealed record Envelope
{
    public int Version { get; init; } = 1;
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Type { get; init; } = "";
    public string At { get; init; } = DateTimeOffset.UtcNow.ToString("o");
    public string? PayloadJson { get; init; }

    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string ToJson() => JsonSerializer.Serialize(this, JsonOptions);

    public static Envelope? FromJson(string json) =>
        JsonSerializer.Deserialize<Envelope>(json, JsonOptions);

    public static Envelope Create(string type, object? payload = null) => new()
    {
        Type = type,
        PayloadJson = payload is null ? null : JsonSerializer.Serialize(payload, JsonOptions),
    };
}

public static class MessageTypes
{
    public const string Hello = "hello";
    public const string Welcome = "welcome";
    public const string Heartbeat = "heartbeat";
    public const string ActionRequest = "action.request";
    public const string ActionResult = "action.result";
    public const string ScreenSessionStart = "screen.session.start";
    public const string ScreenSessionStop = "screen.session.stop";
    public const string ScreenFrame = "screen.frame";
    public const string NotAus = "not-aus";
    public const string Revoke = "revoke";
}

public sealed record PairingRequest(
    string Code,
    string DeviceName,
    string Platform,
    string PublicKeySpki,
    string AgentVersion);

public sealed record PairingResponse(string DeviceId, string DeviceToken);

public sealed record ActionResultPayload(string RequestId, string Status, string? Detail);
