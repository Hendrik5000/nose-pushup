using MiraDeviceAgent;
using Xunit;

namespace MiraDeviceAgent.Tests;

public class MessageTests
{
    [Fact]
    public void Envelope_serialisiert_roundtrip()
    {
        var envelope = Envelope.Create(MessageTypes.Hello, new { deviceId = "dev1", platform = "windows" });
        var json = envelope.ToJson();
        var back = Envelope.FromJson(json);
        Assert.NotNull(back);
        Assert.Equal(MessageTypes.Hello, back!.Type);
        Assert.Equal(envelope.Id, back.Id);
        Assert.Contains("dev1", back.PayloadJson);
    }

    [Fact]
    public void Kopplungsanfrage_enthaelt_code_und_oeffentlichen_schluessel()
    {
        var request = new PairingRequest("123456", "Test-PC", "windows", "spki-basis64", AgentVersion.Current);
        Assert.Equal("123456", request.Code);
        Assert.Equal("windows", request.Platform);
        Assert.Equal("spki-basis64", request.PublicKeySpki);
    }

    [Fact]
    public void Allowlist_enthaelt_ausgewaehlte_Werkzeuge_und_blockiert_Freiform_Shell()
    {
        Assert.True(ActionAllowlist.IsAllowed("programme.starten"));
        Assert.True(ActionAllowlist.IsAllowed("eingabe.tastatur"));
        Assert.False(ActionAllowlist.IsAllowed("shell.execute"));
        Assert.False(ActionAllowlist.IsAllowed("powershell.execute"));
    }
}
