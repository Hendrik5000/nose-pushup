using MiraDeviceAgent;
using System.Text.Json;
using Xunit;

namespace MiraDeviceAgent.Tests;

public class WindowsActionToolTests
{
    [Theory]
    [InlineData("status.ping", true)]
    [InlineData("programme.starten", true)]
    [InlineData("dateien.verschieben", true)]
    [InlineData("shell.execute", false)]
    [InlineData("powershell.execute", false)]
    public void Allowlist_enthaelt_nur_explizite_Werkzeuge(string tool, bool expected) =>
        Assert.Equal(expected, ActionAllowlist.IsAllowed(tool));

    [Fact]
    public async Task Unbekanntes_Werkzeug_wird_nicht_ausgefuehrt()
    {
        using var args = JsonDocument.Parse("{}");
        var result = await WindowsActionTools.ExecuteAsync("req-1", "shell.execute", args.RootElement, false);
        Assert.Equal("error", result.Status);
    }

    [Fact]
    public void Dateipfad_und_Kritische_Aktion_sind_auf_Allowlist_begrenzt()
    {
        Assert.True(ActionAllowlist.IsAllowed("einstellungen.herunterfahren"));
        Assert.False(ActionAllowlist.IsAllowed("dateien.loeschen"));
    }
}
