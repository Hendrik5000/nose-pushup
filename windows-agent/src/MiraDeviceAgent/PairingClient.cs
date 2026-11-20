using System.Text;
using System.Text.Json;

namespace MiraDeviceAgent;

/// <summary>Kopplung über den Einmal-Code aus der Mira-UI (serverseitig TTL 5 Minuten).</summary>
public static class PairingClient
{
    public static async Task<PairingResponse> PairAsync(
        HttpClient httpClient,
        string gatewayBaseUrl,
        PairingRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(gatewayBaseUrl)) throw new ArgumentException("Gateway-Basis-URL fehlt.");
        if (!Uri.TryCreate(gatewayBaseUrl.TrimEnd('/') + "/v1/pair", UriKind.Absolute, out var uri)
            || uri.Scheme is not ("https" or "http"))
        {
            throw new ArgumentException("Ungültige Gateway-Basis-URL.");
        }
        if (uri.Scheme == "http" && uri.Host is not ("localhost" or "127.0.0.1"))
        {
            // Klartext nur zu localhost (lokale Entwicklung), sonst verweigern.
            throw new InvalidOperationException("Kopplung über unverschlüsseltes HTTP ist nur zu localhost erlaubt.");
        }

        var json = JsonSerializer.Serialize(request, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await httpClient.PostAsync(uri, content, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Kopplung fehlgeschlagen: HTTP " + (int)response.StatusCode);
        }
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        var result = await JsonSerializer.DeserializeAsync<PairingResponse>(stream,
            new JsonSerializerOptions(JsonSerializerDefaults.Web), cancellationToken).ConfigureAwait(false);
        return result ?? throw new InvalidOperationException("Kopplungsantwort war leer.");
    }
}
