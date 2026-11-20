using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;

namespace MiraDeviceAgent;

/// <summary>
/// Bildschirmübertragung ausschließlich während einer vom Gateway gestarteten
/// und zuvor ausdrücklich freigegebenen Sitzung. Frames werden nicht gespeichert.
/// </summary>
public sealed class ScreenCaptureService
{
    private readonly GatewayConnection _connection;
    private CancellationTokenSource? _session;
    private Task? _loop;
    private string? _previousTitle;

    public ScreenCaptureService(GatewayConnection connection) => _connection = connection;

    public void Start(string sessionId)
    {
        _ = StopAsync();
        _session = new CancellationTokenSource();
        try
        {
            _previousTitle = Console.Title;
            Console.Title = "Mira Device Agent — BILDSCHIRM FREIGEGEBEN";
            Console.WriteLine("BILDSCHIRM-FREIGABE AKTIV. Übertragung läuft; Not-Aus oder Sitzungsende stoppt sie.");
        }
        catch { /* Agent kann ohne interaktive Konsole laufen. */ }
        _loop = CaptureLoopAsync(sessionId, _session.Token);
    }

    public async Task StopAsync()
    {
        var current = _session;
        _session = null;
        if (current is null) return;
        current.Cancel();
        if (_loop is not null)
        {
            try { await _loop.ConfigureAwait(false); }
            catch (OperationCanceledException) { }
        }
        current.Dispose();
        _loop = null;
        try
        {
            if (_previousTitle is not null) Console.Title = _previousTitle;
            Console.WriteLine("Bildschirmfreigabe beendet.");
        }
        catch { }
    }

    private async Task CaptureLoopAsync(string sessionId, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var frame = CaptureJpeg();
                await _connection.SendAsync(
                    Envelope.Create(MessageTypes.ScreenFrame, new
                    {
                        sessionId,
                        frameBase64 = Convert.ToBase64String(frame)
                    }),
                    cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) { break; }
            catch
            {
                // Einzelner Capture-Fehler beendet nicht die gesamte Gerätesitzung.
            }
            await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken).ConfigureAwait(false);
        }
    }

    private static byte[] CaptureJpeg()
    {
        var bounds = SystemInformation.VirtualScreen;
        if (bounds.Width <= 0 || bounds.Height <= 0) throw new InvalidOperationException("Kein Bildschirm verfügbar.");
        var scale = Math.Min(1d, 1280d / bounds.Width);
        var width = Math.Max(1, (int)(bounds.Width * scale));
        var height = Math.Max(1, (int)(bounds.Height * scale));
        using var source = new Bitmap(bounds.Width, bounds.Height);
        using (var graphics = Graphics.FromImage(source))
            graphics.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, source.Size);
        using var resized = new Bitmap(width, height);
        using (var graphics = Graphics.FromImage(resized))
        {
            graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            graphics.DrawImage(source, 0, 0, width, height);
        }
        using var stream = new MemoryStream();
        var encoder = ImageCodecInfo.GetImageEncoders().First(x => x.MimeType == "image/jpeg");
        using var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 45L);
        resized.Save(stream, encoder, parameters);
        return stream.ToArray();
    }
}
