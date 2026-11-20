namespace MiraDeviceAgent;

/// <summary>
/// Eng begrenzte Allowlist. In Phase 2 ist sie bewusst leer: Steuerungswerkzeuge
/// (Programme, Fenster, Eingaben, Bildschirm, Dateien, Einstellungen, Audio)
/// folgen erst in Phase 3 - und auch dann nur mit validierten Parametern und
/// geprüften Berechtigungen.
/// </summary>
public static class ActionAllowlist
{
    public static readonly IReadOnlySet<string> Allowed = new HashSet<string>();

    public static bool IsAllowed(string toolId) => Allowed.Contains(toolId);
}

public static class ActionExecutor
{
    /// <summary>Hängt die (in Phase 2 noch durchgehend ablehnende) Werkzeugbehandlung an eine Verbindung.</summary>
    public static void Register(GatewayConnection connection)
    {
        connection.EnvelopeReceived += envelope =>
        {
            if (envelope.Type != MessageTypes.ActionRequest) return;
            var result = new ActionResultPayload(
                "unbekannt",
                "nicht-implementiert",
                "Windows-Steuerungswerkzeuge folgen in Phase 3.");
            _ = connection.SendAsync(
                Envelope.Create(MessageTypes.ActionResult, result), CancellationToken.None);
        };
    }
}
