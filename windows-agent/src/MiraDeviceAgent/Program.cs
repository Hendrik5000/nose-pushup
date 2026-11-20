using MiraDeviceAgent;

// Mira Device Agent - Phase 3: sichere Kopplung und eng begrenzte Windows-Steuerungswerkzeuge.

var version = AgentVersion.Current;
while (true)
{
    Console.WriteLine();
    Console.WriteLine("=== Mira Device Agent (Phase 3, v" + version + ") ===");
    Console.WriteLine("1) Status anzeigen");
    Console.WriteLine("2) Kopplung starten (Gateway-URL + Einmalcode)");
    Console.WriteLine("3) Autostart ein-/ausschalten (aktuell: " + (AutostartManager.IsEnabled() ? "an" : "aus") + ")");
    Console.WriteLine("4) Identität widerrufen (lokal löschen)");
    Console.WriteLine("0) Beenden");
    Console.Write("Auswahl: ");
    var choice = Console.ReadLine()?.Trim();

    try
    {
        switch (choice)
        {
            case "1":
            {
                var identity = DeviceIdentityStore.Load();
                Console.WriteLine(identity is null
                    ? "Gerät: nicht gekoppelt"
                    : "Gerät: " + identity.DeviceId + " (Schlüssel erstellt " + identity.CreatedAt + ")");
                Console.WriteLine("Autostart: " + (AutostartManager.IsEnabled() ? "an (jederzeit abschaltbar)" : "aus"));
                break;
            }
            case "2":
            {
                Console.Write("Gateway-Basis-URL (https://...): ");
                var baseUrl = Console.ReadLine()?.Trim() ?? "";
                Console.Write("Einmal-Kopplungscode (6 Ziffern): ");
                var code = Console.ReadLine()?.Trim() ?? "";
                if (code.Length != 6 || !code.All(char.IsDigit))
                {
                    Console.WriteLine("Code muss aus 6 Ziffern bestehen.");
                    break;
                }
                var identity = DeviceIdentityStore.Load() ?? DeviceIdentityStore.CreateNew();
                using var http = new HttpClient();
                var response = await PairingClient.PairAsync(http, baseUrl, new PairingRequest(
                    Code: code,
                    DeviceName: Environment.MachineName,
                    Platform: "windows",
                    PublicKeySpki: identity.PublicKeySpki,
                    AgentVersion: version));
                identity = identity with { DeviceId = response.DeviceId };
                DeviceIdentityStore.Save(identity);
                DeviceIdentityStore.SaveToken(response.DeviceToken);
                Console.WriteLine("Gekoppelt als " + response.DeviceId + ". Verbindung wird hergestellt (Strg+C beendet) …");
                await using var connection = new GatewayConnection(
                    new Uri(baseUrl.TrimEnd('/') + "/v1/ws"), identity, response.DeviceToken);
                ActionExecutor.Register(connection);
                var cts = new CancellationTokenSource();
                Console.CancelKeyPress += (_, eventArgs) => { eventArgs.Cancel = true; cts.Cancel(); };
                await connection.RunAsync(cts.Token);
                Console.WriteLine("Verbindung beendet.");
                break;
            }
            case "3":
            {
                AutostartManager.SetEnabled(!AutostartManager.IsEnabled());
                Console.WriteLine("Autostart ist jetzt: " + (AutostartManager.IsEnabled() ? "an" : "aus"));
                break;
            }
            case "4":
            {
                DeviceIdentityStore.DeleteAll();
                Console.WriteLine("Identität und Token gelöscht. Das Gerät gilt als widerrufen.");
                break;
            }
            case "0":
                return 0;
            default:
                Console.WriteLine("Unbekannte Auswahl.");
                break;
        }
    }
    catch (Exception ex)
    {
        // Keine Geheimnisse in Fehlermeldungen.
        Console.WriteLine("Fehler: " + ex.Message);
    }
}
