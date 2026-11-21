package app.alo.miraagent

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.TimeUnit

object PairingClient {
    private val client = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS).callTimeout(20, TimeUnit.SECONDS).build()

    data class Result(val deviceId: String, val deviceToken: String)

    fun validateGatewayUrl(raw: String): String {
        val uri = URI(raw.trim().trimEnd('/'))
        require(uri.scheme == "https" && !uri.host.isNullOrBlank()) { "Bitte eine öffentliche HTTPS-Gateway-Adresse verwenden." }
        require(uri.userInfo == null && uri.rawQuery == null && uri.rawFragment == null && (uri.rawPath.isNullOrEmpty() || uri.rawPath == "/")) {
            "Die Gateway-Adresse darf keine Zugangsdaten, Pfade oder URL-Parameter enthalten."
        }
        return uri.toString().trimEnd('/')
    }

    fun pair(gatewayUrl: String, code: String, deviceName: String): Result {
        require(code.matches(Regex("[0-9]{6}"))) { "Der Kopplungscode muss aus sechs Ziffern bestehen." }
        require(deviceName.isNotBlank() && deviceName.length <= 100) { "Bitte einen gültigen Gerätenamen eingeben." }
        val body = JSONObject().put("code", code).put("deviceName", deviceName.trim())
            .put("platform", "android").put("publicKeySpki", DeviceIdentityStore.publicKeySpkiBase64())
            .put("agentVersion", "0.1.0").toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder().url("$gatewayUrl/v1/pair").post(body).build()
        client.newCall(request).execute().use { response ->
            val responseText = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException("Kopplung fehlgeschlagen (HTTP ${response.code}).")
            val json = JSONObject(responseText)
            val id = json.optString("deviceId")
            val token = json.optString("deviceToken")
            if (id.isBlank() || token.isBlank()) throw IllegalStateException("Die Gateway-Antwort enthält keine gültige Geräteidentität.")
            return Result(id, token)
        }
    }
}
