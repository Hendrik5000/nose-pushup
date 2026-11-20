using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MiraDeviceAgent;

/// <summary>Geräteidentität: RSA-2048, privater Schlüssel nur DPAPI-verschlüsselt.</summary>
public sealed record DeviceIdentity(
    string DeviceId,
    string PublicKeySpki,
    byte[] ProtectedPrivateKey,
    string CreatedAt);

public static class DeviceIdentityStore
{
    private static readonly string DirectoryPath =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MiraDeviceAgent");

    private static string IdentityFilePath => Path.Combine(DirectoryPath, "identity.json");
    private static string TokenFilePath => Path.Combine(DirectoryPath, "token.bin");

    public static DeviceIdentity CreateNew()
    {
        using var rsa = RSA.Create(2048);
        var spki = Convert.ToBase64String(rsa.ExportSubjectPublicKeyInfo());
        var pkcs8 = rsa.ExportPkcs8PrivateKey();
        // DPAPI CurrentUser: nur dieser Windows-Account kann den Schlüssel lesen.
        var protectedKey = ProtectedData.Protect(pkcs8, null, DataProtectionScope.CurrentUser);
        return new DeviceIdentity(
            DeviceId: Guid.NewGuid().ToString("n"),
            PublicKeySpki: spki,
            ProtectedPrivateKey: protectedKey,
            CreatedAt: DateTimeOffset.UtcNow.ToString("o"));
    }

    public static void Save(DeviceIdentity identity)
    {
        Directory.CreateDirectory(DirectoryPath);
        var json = JsonSerializer.Serialize(identity, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        File.WriteAllText(IdentityFilePath, json);
    }

    public static DeviceIdentity? Load()
    {
        if (!File.Exists(IdentityFilePath)) return null;
        try
        {
            return JsonSerializer.Deserialize<DeviceIdentity>(
                File.ReadAllText(IdentityFilePath),
                new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        catch
        {
            return null;
        }
    }

    public static void SaveToken(string token)
    {
        Directory.CreateDirectory(DirectoryPath);
        var protectedToken = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(TokenFilePath, protectedToken);
    }

    public static string? LoadToken()
    {
        if (!File.Exists(TokenFilePath)) return null;
        try
        {
            return Encoding.UTF8.GetString(
                ProtectedData.Unprotect(File.ReadAllBytes(TokenFilePath), null, DataProtectionScope.CurrentUser));
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Löscht Identität und Token vollständig (Widerruf / Reset).</summary>
    public static void DeleteAll()
    {
        if (File.Exists(IdentityFilePath)) File.Delete(IdentityFilePath);
        if (File.Exists(TokenFilePath)) File.Delete(TokenFilePath);
    }
}
