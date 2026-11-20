using System.Net.WebSockets;
using System.Text;

namespace MiraDeviceAgent;

/// <summary>
/// Ausgehende, authentifizierte WSS-Verbindung zum Device Control Gateway.
/// Kein eingehender Port. Reconnect mit exponentiellem Backoff, Widerruf-Erkennung
/// über WebSocket-Close-Code 4403.
/// </summary>
public sealed class GatewayConnection : IAsyncDisposable
{
    private readonly Uri _gatewayUri;
    private readonly DeviceIdentity _identity;
    private readonly string _deviceToken;
    private ClientWebSocket? _socket;
    private CancellationTokenSource? _lifetime;

    public GatewayConnection(Uri gatewayUri, DeviceIdentity identity, string deviceToken)
    {
        _gatewayUri = gatewayUri;
        _identity = identity;
        _deviceToken = deviceToken;
    }

    public event Action<string>? StateChanged; // "verbinde" | "verbunden" | "offline" | "widerrufen"
    public event Action<Envelope>? EnvelopeReceived;
    public event Action<Envelope>? NotAusReceived;

    public string CurrentState { get; private set; } = "offline";

    private void SetState(string state)
    {
        CurrentState = state;
        StateChanged?.Invoke(state);
    }

    /// <summary>Hält die Verbindung inklusive Wiederverbindung, bis Abbruch oder Widerruf.</summary>
    public async Task RunAsync(CancellationToken cancellationToken)
    {
        _lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var delaySeconds = 1;
        while (!_lifetime.IsCancellationRequested)
        {
            try
            {
                SetState("verbinde");
                using var socket = new ClientWebSocket();
                socket.Options.SetRequestHeader("Authorization", "Bearer " + _deviceToken);
                socket.Options.SetRequestHeader("X-Mira-Device", _identity.DeviceId);
                await socket.ConnectAsync(_gatewayUri, _lifetime.Token).ConfigureAwait(false);
                _socket = socket;
                SetState("verbunden");
                delaySeconds = 1;
                await SendAsync(Envelope.Create(MessageTypes.Hello, new
                {
                    deviceId = _identity.DeviceId,
                    platform = "windows",
                    agentVersion = AgentVersion.Current,
                }), _lifetime.Token).ConfigureAwait(false);

                using var connectionLifetime = CancellationTokenSource.CreateLinkedTokenSource(_lifetime.Token);
                var heartbeatTask = HeartbeatLoop(connectionLifetime.Token);
                var receiveTask = ReceiveLoop(socket, connectionLifetime.Token);
                var completedTask = await Task.WhenAny(heartbeatTask, receiveTask).ConfigureAwait(false);

                // Heartbeat und Empfang laufen parallel. Endet einer der beiden
                // Tasks unerwartet, wird die Verbindung beendet und neu aufgebaut.
                if (completedTask == heartbeatTask && !connectionLifetime.IsCancellationRequested)
                {
                    connectionLifetime.Cancel();
                }

                var revoked = false;
                try
                {
                    revoked = await receiveTask.ConfigureAwait(false);
                }
                finally
                {
                    connectionLifetime.Cancel();
                    try { await heartbeatTask.ConfigureAwait(false); }
                    catch (OperationCanceledException) { }
                }

                if (revoked)
                {
                    DeviceIdentityStore.DeleteAll();
                    SetState("widerrufen");
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                SetState("offline");
            }
            finally
            {
                _socket = null;
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(delaySeconds), _lifetime.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            delaySeconds = Math.Min(delaySeconds * 2, 60);
        }
    }

    /// <summary>Gibt true zurück, wenn das Gateway den Widerruf (4403) signalisiert hat.</summary>
    private async Task<bool> ReceiveLoop(ClientWebSocket socket, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && socket.State == WebSocketState.Open)
        {
            var message = await ReceiveFullMessage(socket, ct).ConfigureAwait(false);
            if (message.messageBytes is null) return message.revoked;
            var envelope = Envelope.FromJson(Encoding.UTF8.GetString(message.messageBytes));
            if (envelope is null) continue;
            if (envelope.Type == MessageTypes.Revoke)
            {
                return true;
            }
            if (envelope.Type == MessageTypes.NotAus)
            {
                NotAusReceived?.Invoke(envelope);
            }
            EnvelopeReceived?.Invoke(envelope);
        }
        return false;
    }

    private static async Task<(byte[]? messageBytes, bool revoked)> ReceiveFullMessage(
        ClientWebSocket socket, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        var buffer = new byte[64 * 1024];
        while (true)
        {
            var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), ct).ConfigureAwait(false);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                var revoked = (int?)socket.CloseStatus == 4403;
                try
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None)
                        .ConfigureAwait(false);
                }
                catch
                {
                    // Close-Bestätigung ist optional; Hauptsache die Verbindung endet.
                }
                return (null, revoked);
            }
            ms.Write(buffer, 0, result.Count);
            if (result.EndOfMessage) return (ms.ToArray(), false);
        }
    }

    public async Task SendAsync(Envelope envelope, CancellationToken ct)
    {
        var socket = _socket;
        if (socket is null || socket.State != WebSocketState.Open) return;
        var bytes = Encoding.UTF8.GetBytes(envelope.ToJson());
        await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct).ConfigureAwait(false);
    }

    private async Task HeartbeatLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(30), ct).ConfigureAwait(false);
                await SendAsync(Envelope.Create(MessageTypes.Heartbeat), CancellationToken.None).ConfigureAwait(false);
            }
            catch
            {
                return;
            }
        }
    }

    public ValueTask DisposeAsync()
    {
        _lifetime?.Cancel();
        _socket?.Dispose();
        return ValueTask.CompletedTask;
    }
}

public static class AgentVersion
{
    public const string Current = "0.3.0-phase3";
}
