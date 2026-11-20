using System.Text.Json;

namespace MiraDeviceAgent;

/// <summary>
/// Allowlist der tatsächlich implementierten Windows-Werkzeuge. Freiform-Shell
/// und beliebige PowerShell-Ausführung sind ausdrücklich nicht enthalten.
/// </summary>
public static class ActionAllowlist
{
    private static readonly HashSet<string> Allowed = new(StringComparer.Ordinal)
    {
        "status.ping", "status.info",
        "programme.liste", "programme.starten", "programme.beenden",
        "fenster.liste", "fenster.fokussieren", "fenster.minimieren", "fenster.maximieren",
        "eingabe.maus", "eingabe.tastatur",
        "dateien.auflisten", "dateien.lesen", "dateien.schreiben",
        "dateien.umbenennen", "dateien.verschieben",
        "einstellungen.oeffnen", "einstellungen.herunterfahren", "einstellungen.abbrechen-herunterfahren",
        "audio.lautstaerke", "audio.stummschalten"
    };

    public static bool IsAllowed(string toolId) => Allowed.Contains(toolId);
}

public static class ActionExecutor
{
    public static void Register(GatewayConnection connection)
    {
        var screen = new ScreenCaptureService(connection);
        connection.EnvelopeReceived += envelope =>
        {
            if (envelope.Type == MessageTypes.ActionRequest)
            {
                _ = HandleActionAsync(connection, envelope);
                return;
            }

            if (envelope.Type == MessageTypes.ScreenSessionStart)
            {
                var sessionId = ReadString(envelope.PayloadJson, "sessionId");
                if (!string.IsNullOrWhiteSpace(sessionId))
                {
                    _ = screen.StartAsync(sessionId);
                }
                return;
            }

            if (envelope.Type == MessageTypes.ScreenSessionStop || envelope.Type == MessageTypes.NotAus)
            {
                _ = screen.StopAsync();
            }
        };
        connection.NotAusReceived += _ => _ = screen.StopAsync();
    }

    private static async Task HandleActionAsync(GatewayConnection connection, Envelope envelope)
    {
        var requestId = "unbekannt";
        ActionResultPayload result;
        try
        {
            using var document = JsonDocument.Parse(envelope.PayloadJson ?? "{}");
            var root = document.RootElement;
            requestId = GetString(root, "requestId", 64) ?? "unbekannt";
            var toolId = GetString(root, "toolId", 64) ?? "";
            var args = root.TryGetProperty("args", out var value) && value.ValueKind == JsonValueKind.Object
                ? value
                : default;
            var confirmationGranted = root.TryGetProperty("confirmationGranted", out var confirmed)
                && confirmed.ValueKind == JsonValueKind.True;

            if (!ActionAllowlist.IsAllowed(toolId))
            {
                result = new ActionResultPayload(requestId, "nicht-implementiert", "Werkzeug ist nicht freigegeben.");
            }
            else if (toolId == "einstellungen.herunterfahren" && !confirmationGranted)
            {
                result = new ActionResultPayload(requestId, "bestaetigung-erforderlich", "Kritische Aktion benötigt eine ausdrückliche Bestätigung.");
            }
            else
            {
                result = await WindowsActionTools.ExecuteAsync(requestId, toolId, args, confirmationGranted);
            }
        }
        catch (Exception)
        {
            result = new ActionResultPayload(requestId, "error", "Anfrage konnte nicht sicher verarbeitet werden.");
        }

        try
        {
            await connection.SendAsync(Envelope.Create(MessageTypes.ActionResult, result), CancellationToken.None);
        }
        catch
        {
            // Verbindung kann während der Aktion beendet worden sein.
        }
    }

    private static string? ReadString(string? json, string property)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        using var doc = JsonDocument.Parse(json);
        return GetString(doc.RootElement, property, 128);
    }

    private static string? GetString(JsonElement element, string property, int maxLength)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(property, out var value) ||
            value.ValueKind != JsonValueKind.String)
            return null;
        var text = value.GetString();
        return text is not null && text.Length <= maxLength ? text : null;
    }
}
