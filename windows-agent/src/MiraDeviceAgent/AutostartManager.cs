using Microsoft.Win32;

namespace MiraDeviceAgent;

/// <summary>
/// Optionaler Autostart, jederzeit vom Nutzer steuerbar (HKCU-Level, keine Adminrechte).
/// </summary>
public static class AutostartManager
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "MiraDeviceAgent";

    public static bool IsEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath);
        return key?.GetValue(ValueName) is string;
    }

    public static void Enable()
    {
        var exePath = Environment.ProcessPath
            ?? throw new InvalidOperationException("Prozesspfad nicht ermittelbar.");
        using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath);
        key.SetValue(ValueName, '"' + exePath + '"' + " --background");
    }

    public static void Disable()
    {
        using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath);
        if (key.GetValue(ValueName) is not null) key.DeleteValue(ValueName);
    }

    public static void SetEnabled(bool enabled)
    {
        if (enabled) Enable(); else Disable();
    }
}
