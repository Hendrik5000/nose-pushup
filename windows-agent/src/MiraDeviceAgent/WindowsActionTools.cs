using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace MiraDeviceAgent;

/// <summary>
/// Lokale Windows-Aktionen mit enger Allowlist, validierten Argumenten und
/// beschränktem Dateizugriff. Es gibt absichtlich keine generische Shell.
/// </summary>
public static class WindowsActionTools
{
    private static readonly string[] KnownApps =
        ["notepad", "calc", "explorer", "mspaint", "msedge", "chrome", "firefox", "code", "steam", "discord"];

    private static readonly Dictionary<string, string> SettingsPages = new(StringComparer.OrdinalIgnoreCase)
    {
        ["display"] = "ms-settings:display",
        ["sound"] = "ms-settings:sound",
        ["network"] = "ms-settings:network",
        ["bluetooth"] = "ms-settings:bluetooth",
        ["windows-update"] = "ms-settings:windowsupdate",
        ["apps"] = "ms-settings:appsfeatures",
        ["personalization"] = "ms-settings:personalization",
        ["privacy"] = "ms-settings:privacy"
    };

    private static readonly Dictionary<string, string> UserRoots = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Desktop"] = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
        ["Documents"] = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
        ["Downloads"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads")
    };

    public static Task<ActionResultPayload> ExecuteAsync(
        string requestId, string toolId, JsonElement args, bool confirmationGranted)
    {
        try
        {
            var detail = toolId switch
            {
                "status.ping" => "Agent erreichbar.",
                "status.info" => StatusInfo(),
                "programme.liste" => ListProcesses(),
                "programme.starten" => StartProgram(args),
                "programme.beenden" => CloseProgram(args),
                "fenster.liste" => ListWindows(),
                "fenster.fokussieren" => ChangeWindow(args, "focus"),
                "fenster.minimieren" => ChangeWindow(args, "minimize"),
                "fenster.maximieren" => ChangeWindow(args, "maximize"),
                "eingabe.maus" => Mouse(args),
                "eingabe.tastatur" => Keyboard(args),
                "dateien.auflisten" => ListFiles(args),
                "dateien.lesen" => ReadTextFile(args),
                "dateien.schreiben" => WriteTextFile(args),
                "dateien.umbenennen" => RenameFile(args),
                "dateien.verschieben" => MoveFile(args),
                "einstellungen.oeffnen" => OpenSettings(args),
                "einstellungen.herunterfahren" => ScheduleShutdown(confirmationGranted),
                "einstellungen.abbrechen-herunterfahren" => CancelShutdown(),
                "audio.lautstaerke" => ChangeVolume(args),
                "audio.stummschalten" => ToggleMute(),
                _ => throw new NotSupportedException("Werkzeug nicht unterstützt.")
            };
            return Task.FromResult(new ActionResultPayload(requestId, "ok", Limit(detail)));
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException or
                                   InvalidOperationException or NotSupportedException or System.ComponentModel.Win32Exception)
        {
            return Task.FromResult(new ActionResultPayload(requestId, "error", Limit(SafeMessage(ex))));
        }
    }

    private static string StatusInfo() =>
        JsonSerializer.Serialize(new
        {
            os = Environment.OSVersion.VersionString,
            agent = AgentVersion.Current,
            machine = Environment.MachineName,
            uptimeSeconds = (long)Environment.TickCount64 / 1000
        });

    private static string ListProcesses()
    {
        var rows = new List<object>();
        foreach (var process in Process.GetProcesses().OrderBy(p => p.ProcessName).Take(80))
        {
            try
            {
                rows.Add(new { id = process.Id, name = process.ProcessName, window = SafeWindowTitle(process) });
            }
            catch { /* Prozess kann während der Auflistung enden. */ }
            finally { process.Dispose(); }
        }
        return JsonSerializer.Serialize(rows);
    }

    private static string SafeWindowTitle(Process process)
    {
        try { return process.MainWindowTitle.Length > 120 ? process.MainWindowTitle[..120] : process.MainWindowTitle; }
        catch { return ""; }
    }

    private static string StartProgram(JsonElement args)
    {
        var app = RequiredString(args, "app", 100).ToLowerInvariant();
        if (!KnownApps.Contains(app, StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException("App nicht in der sicheren Startliste. Unterstützt: " + string.Join(", ", KnownApps));
        var process = Process.Start(new ProcessStartInfo(app + ".exe") { UseShellExecute = true });
        return process is null ? "Start angefordert." : "Programmstart angefordert (PID " + process.Id + ").";
    }

    private static string CloseProgram(JsonElement args)
    {
        var id = RequiredInt(args, "processId", 1, int.MaxValue);
        if (id == Environment.ProcessId) throw new ArgumentException("Der Mira-Agent darf sich nicht selbst schließen.");
        using var process = Process.GetProcessById(id);
        if (!process.CloseMainWindow())
            throw new InvalidOperationException("Das Programm besitzt kein schließbares Hauptfenster.");
        return "Schließen des Hauptfensters angefordert.";
    }

    private static string ListWindows()
    {
        var rows = new List<object>();
        EnumWindows((handle, _) =>
        {
            if (!IsWindowVisible(handle)) return true;
            var length = GetWindowTextLength(handle);
            if (length <= 0 || rows.Count >= 80) return true;
            var title = new StringBuilder(Math.Min(length + 1, 512));
            _ = GetWindowText(handle, title, title.Capacity);
            _ = GetWindowThreadProcessId(handle, out var processId);
            rows.Add(new { handle = handle.ToInt64().ToString("X"), processId, title = title.ToString() });
            return true;
        }, IntPtr.Zero);
        return JsonSerializer.Serialize(rows);
    }

    private static string ChangeWindow(JsonElement args, string action)
    {
        var handleText = RequiredString(args, "handle", 32);
        if (!long.TryParse(handleText, System.Globalization.NumberStyles.HexNumber, null, out var raw))
            throw new ArgumentException("Fensterkennung ungültig.");
        var handle = new IntPtr(raw);
        if (!IsWindow(handle) || !IsWindowVisible(handle))
            throw new ArgumentException("Fenster ist nicht mehr verfügbar.");
        switch (action)
        {
            case "focus":
                _ = ShowWindow(handle, 9);
                if (!SetForegroundWindow(handle)) throw new InvalidOperationException("Fenster konnte nicht fokussiert werden.");
                break;
            case "minimize": _ = ShowWindow(handle, 6); break;
            case "maximize": _ = ShowWindow(handle, 3); break;
        }
        return "Fensteraktion ausgeführt.";
    }

    private static string Mouse(JsonElement args)
    {
        var action = RequiredString(args, "action", 16);
        var x = RequiredInt(args, "x", 0, System.Windows.Forms.Screen.PrimaryScreen?.Bounds.Width ?? 10000);
        var y = RequiredInt(args, "y", 0, System.Windows.Forms.Screen.PrimaryScreen?.Bounds.Height ?? 10000);
        if (!SetCursorPos(x, y)) throw new InvalidOperationException("Mausposition konnte nicht gesetzt werden.");
        if (action == "move") return "Maus bewegt.";
        if (action != "click") throw new ArgumentException("Mausaktion muss move oder click sein.");
        var button = OptionalString(args, "button", 16) ?? "left";
        var flags = button switch
        {
            "left" => (down: 0x0002u, up: 0x0004u),
            "right" => (down: 0x0008u, up: 0x0010u),
            "middle" => (down: 0x0020u, up: 0x0040u),
            _ => throw new ArgumentException("Mausbutton nicht unterstützt.")
        };
        SendMouse(flags.down);
        SendMouse(flags.up);
        return "Mausklick ausgeführt.";
    }

    private static string Keyboard(JsonElement args)
    {
        var text = OptionalString(args, "text", 500);
        if (!string.IsNullOrEmpty(text))
        {
            foreach (var character in text)
            {
                var down = new INPUT { type = 1, U = new INPUTUNION { ki = new KEYBDINPUT { wScan = character, dwFlags = 0x0004 } } };
                var up = new INPUT { type = 1, U = new INPUTUNION { ki = new KEYBDINPUT { wScan = character, dwFlags = 0x0004 | 0x0002 } } };
                SendInputs([down, up]);
            }
            return "Text eingegeben.";
        }

        var key = RequiredString(args, "key", 32).ToUpperInvariant();
        var combinations = new Dictionary<string, ushort[]>(StringComparer.Ordinal)
        {
            ["ENTER"] = [0x0D], ["TAB"] = [0x09], ["ESC"] = [0x1B], ["BACKSPACE"] = [0x08],
            ["DELETE"] = [0x2E], ["UP"] = [0x26], ["DOWN"] = [0x28], ["LEFT"] = [0x25],
            ["RIGHT"] = [0x27], ["HOME"] = [0x24], ["END"] = [0x23], ["PAGEUP"] = [0x21],
            ["PAGEDOWN"] = [0x22], ["F5"] = [0x74], ["CTRL+C"] = [0x11, 0x43],
            ["CTRL+V"] = [0x11, 0x56], ["CTRL+S"] = [0x11, 0x53], ["CTRL+Z"] = [0x11, 0x5A],
            ["ALT+TAB"] = [0x12, 0x09]
        };
        if (!combinations.TryGetValue(key, out var codes)) throw new ArgumentException("Taste nicht freigegeben.");
        foreach (var code in codes) SendKey(code, true);
        foreach (var code in codes.Reverse()) SendKey(code, false);
        return "Taste ausgeführt.";
    }

    private static string ListFiles(JsonElement args)
    {
        var directory = ResolveUserPath(args, "path", mustExist: true);
        if (!Directory.Exists(directory)) throw new ArgumentException("Ordner nicht gefunden.");
        var entries = Directory.EnumerateFileSystemEntries(directory).Take(50).Select(path => new
        {
            name = Path.GetFileName(path),
            type = Directory.Exists(path) ? "folder" : "file"
        });
        return JsonSerializer.Serialize(entries);
    }

    private static string ReadTextFile(JsonElement args)
    {
        var path = ResolveUserPath(args, "path", mustExist: true);
        var info = new FileInfo(path);
        if (!info.Exists || info.Length > 64 * 1024) throw new ArgumentException("Datei fehlt oder ist größer als 64 KB.");
        return File.ReadAllText(path, Encoding.UTF8);
    }

    private static string WriteTextFile(JsonElement args)
    {
        var path = ResolveUserPath(args, "path", mustExist: false);
        var content = RequiredString(args, "content", 16 * 1024);
        if (File.Exists(path) || Directory.Exists(path)) throw new IOException("Zieldatei existiert bereits; Überschreiben ist gesperrt.");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        using var writer = new StreamWriter(stream, new UTF8Encoding(false));
        writer.Write(content);
        return "Neue Textdatei erstellt.";
    }

    private static string RenameFile(JsonElement args)
    {
        var source = ResolveUserPath(args, "path", mustExist: true);
        var newName = RequiredString(args, "newName", 120);
        if (newName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || newName is "." or ".." ||
            newName.Contains('/') || newName.Contains('\\'))
            throw new ArgumentException("Neuer Dateiname ungültig.");
        var destination = Path.Combine(Path.GetDirectoryName(source)!, newName);
        if (File.Exists(destination) || Directory.Exists(destination)) throw new IOException("Ziel existiert bereits.");
        if (Directory.Exists(source)) Directory.Move(source, destination);
        else File.Move(source, destination);
        return "Umbenannt.";
    }

    private static string MoveFile(JsonElement args)
    {
        var source = ResolveUserPath(args, "sourcePath", mustExist: true, "sourceRoot");
        var destination = ResolveUserPath(args, "destinationPath", mustExist: false, "destinationRoot");
        if (File.Exists(destination) || Directory.Exists(destination)) throw new IOException("Ziel existiert bereits.");
        Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
        if (Directory.Exists(source)) Directory.Move(source, destination);
        else File.Move(source, destination);
        return "Verschoben.";
    }

    private static string ResolveUserPath(JsonElement args, string pathProperty, bool mustExist, string rootProperty = "root")
    {
        var rootName = RequiredString(args, rootProperty, 32);
        if (!UserRoots.TryGetValue(rootName, out var root) || string.IsNullOrWhiteSpace(root))
            throw new ArgumentException("Erlaubter Ordner: Desktop, Documents oder Downloads.");
        var relative = OptionalString(args, pathProperty, 500) ?? "";
        if (Path.IsPathRooted(relative)) throw new ArgumentException("Absolute Pfade sind gesperrt.");
        var fullRoot = Path.GetFullPath(root);
        var fullPath = Path.GetFullPath(Path.Combine(fullRoot, relative));
        var prefix = fullRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!fullPath.Equals(fullRoot, StringComparison.OrdinalIgnoreCase) &&
            !fullPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Pfad liegt außerhalb der freigegebenen Benutzerordner.");
        RejectReparsePoints(fullRoot, fullPath);
        if (mustExist && !File.Exists(fullPath) && !Directory.Exists(fullPath))
            throw new FileNotFoundException("Datei oder Ordner nicht gefunden.");
        return fullPath;
    }

    private static void RejectReparsePoints(string root, string fullPath)
    {
        var relative = Path.GetRelativePath(root, fullPath);
        var current = root;
        if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0)
            throw new UnauthorizedAccessException("Verknüpfte Ordner sind gesperrt.");
        foreach (var part in relative.Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries))
        {
            current = Path.Combine(current, part);
            if ((File.Exists(current) || Directory.Exists(current)) &&
                (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new UnauthorizedAccessException("Verknüpfte Ordner oder Dateien sind gesperrt.");
        }
    }

    private static string OpenSettings(JsonElement args)
    {
        var page = RequiredString(args, "page", 40);
        if (!SettingsPages.TryGetValue(page, out var uri)) throw new ArgumentException("Einstellungsseite nicht freigegeben.");
        _ = Process.Start(new ProcessStartInfo("explorer.exe", uri) { UseShellExecute = true });
        return "Windows-Einstellungen geöffnet.";
    }

    private static string ScheduleShutdown(bool confirmed)
    {
        if (!confirmed) throw new UnauthorizedAccessException("Herunterfahren erfordert eine ausdrückliche Bestätigung.");
        _ = Process.Start(new ProcessStartInfo("shutdown.exe", "/s /t 60") { UseShellExecute = false, CreateNoWindow = true });
        return "Herunterfahren in 60 Sekunden geplant. Mit dem Werkzeug zum Abbrechen kann es gestoppt werden.";
    }

    private static string CancelShutdown()
    {
        _ = Process.Start(new ProcessStartInfo("shutdown.exe", "/a") { UseShellExecute = false, CreateNoWindow = true });
        return "Geplantes Herunterfahren abgebrochen.";
    }

    private static string ChangeVolume(JsonElement args)
    {
        var direction = RequiredString(args, "direction", 8);
        var steps = RequiredInt(args, "steps", 1, 10);
        var key = direction switch { "up" => (ushort)0xAF, "down" => (ushort)0xAE, _ => throw new ArgumentException("direction muss up oder down sein.") };
        for (var i = 0; i < steps; i++) SendKey(key, true, true);
        return "Lautstärke angepasst.";
    }

    private static string ToggleMute()
    {
        SendKey(0xAD, true, true);
        return "Stummschaltung umgeschaltet.";
    }

    private static void SendMouse(uint flags)
    {
        var input = new INPUT { type = 0, U = new INPUTUNION { mi = new MOUSEINPUT { dwFlags = flags } } };
        SendInputs([input]);
    }

    private static void SendKey(ushort code, bool down, bool tap = false)
    {
        var flags = down ? 0u : 0x0002u;
        var input = new INPUT { type = 1, U = new INPUTUNION { ki = new KEYBDINPUT { wVk = code, dwFlags = flags } } };
        SendInputs([input]);
        if (tap && down)
        {
            var release = new INPUT { type = 1, U = new INPUTUNION { ki = new KEYBDINPUT { wVk = code, dwFlags = 0x0002 } } };
            SendInputs([release]);
        }
    }

    private static void SendInputs(INPUT[] inputs)
    {
        if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>()) != inputs.Length)
            throw new InvalidOperationException("Windows hat die Eingabe nicht angenommen.");
    }

    private static string RequiredString(JsonElement args, string name, int maxLength)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var value) ||
            value.ValueKind != JsonValueKind.String)
            throw new ArgumentException("Parameter fehlt: " + name);
        var result = value.GetString() ?? "";
        if (string.IsNullOrWhiteSpace(result) || result.Length > maxLength)
            throw new ArgumentException("Parameter ungültig: " + name);
        return result;
    }

    private static string? OptionalString(JsonElement args, string name, int maxLength)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var value) ||
            value.ValueKind == JsonValueKind.Null) return null;
        if (value.ValueKind != JsonValueKind.String) throw new ArgumentException("Parameter ungültig: " + name);
        var result = value.GetString();
        if (result is not null && result.Length > maxLength) throw new ArgumentException("Parameter zu lang: " + name);
        return result;
    }

    private static int RequiredInt(JsonElement args, string name, int min, int max)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var value) ||
            !value.TryGetInt32(out var result) || result < min || result > max)
            throw new ArgumentException("Zahlenparameter ungültig: " + name);
        return result;
    }

    private static string Limit(string value) => value.Length <= 500 ? value : value[..500];
    private static string SafeMessage(Exception ex) =>
        ex is UnauthorizedAccessException ? "Aktion durch Sicherheitsgrenze blockiert." :
        ex is FileNotFoundException ? "Datei oder Ordner nicht gefunden." :
        ex is NotSupportedException ? "Aktion nicht unterstützt." : "Aktion fehlgeschlagen: " + ex.GetType().Name;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int command);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, INPUT[] inputs, int size);

    [StructLayout(LayoutKind.Sequential)] private struct INPUT { public uint type; public INPUTUNION U; }
    [StructLayout(LayoutKind.Explicit)] private struct INPUTUNION
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT
    {
        public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)] private struct KEYBDINPUT
    {
        public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo;
    }
}
