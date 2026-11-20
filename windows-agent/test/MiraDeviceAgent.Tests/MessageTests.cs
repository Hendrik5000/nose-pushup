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
    public void Allowlist_ist_in_phase_2_leer()
    {
        Assert.False(ActionAllowlist.IsAllowed("program.open"));
        Assert.False(ActionAllowlist.IsAllowed("shell.execute"));
    }

    [Fact]
    public void ActionResult_enthaelt_phase3_hinweis()
    {
        var payload = new ActionResultPayload("req-1", "nicht-implementiert", "Phase 3");
        Assert.Equal("nicht-implementiert", payload.Status);
    }
}
