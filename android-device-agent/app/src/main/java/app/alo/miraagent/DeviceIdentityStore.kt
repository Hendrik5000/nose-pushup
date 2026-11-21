package app.alo.miraagent

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.KeyPairGenerator
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object DeviceIdentityStore {
    private const val KEY_ALIAS = "mira-device-identity-v1"
    private const val TOKEN_KEY_ALIAS = "mira-device-token-aes-v1"
    private const val PREFS = "mira_device_agent"
    private const val DEVICE_ID = "device_id"
    private const val TOKEN = "device_token"
    private const val GATEWAY = "gateway_url"

    private fun keyStore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    fun publicKeySpkiBase64(): String {
        val store = keyStore()
        if (!store.containsAlias(KEY_ALIAS)) {
            val generator = KeyPairGenerator.getInstance("RSA", "AndroidKeyStore")
            generator.initialize(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setKeySize(2048).setDigests(KeyProperties.DIGEST_SHA256)
                .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1).build())
            generator.generateKeyPair()
        }
        val certificate = store.getCertificate(KEY_ALIAS) ?: error("Geräteschlüssel konnte nicht geladen werden.")
        return Base64.encodeToString(certificate.publicKey.encoded, Base64.NO_WRAP)
    }

    private fun tokenKey(): SecretKey {
        val store = keyStore()
        val existing = store.getKey(TOKEN_KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(TOKEN_KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build())
        return generator.generateKey()
    }

    fun save(context: Context, deviceId: String, token: String, gatewayUrl: String) {
        require(deviceId.isNotBlank() && token.isNotBlank())
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, tokenKey())
        val encrypted = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        val stored = cipher.iv + encrypted
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(DEVICE_ID, deviceId).putString(TOKEN, Base64.encodeToString(stored, Base64.NO_WRAP))
            .putString(GATEWAY, gatewayUrl).apply()
    }

    fun load(context: Context): Triple<String, String, String>? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val deviceId = prefs.getString(DEVICE_ID, null) ?: return null
        val encoded = prefs.getString(TOKEN, null) ?: return null
        val gateway = prefs.getString(GATEWAY, null) ?: return null
        return try {
            val stored = Base64.decode(encoded, Base64.NO_WRAP)
            if (stored.size <= 12) return null
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, tokenKey(), GCMParameterSpec(128, stored.copyOfRange(0, 12)))
            val token = String(cipher.doFinal(stored.copyOfRange(12, stored.size)), Charsets.UTF_8)
            Triple(deviceId, token, gateway)
        } catch (_: Exception) { null }
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        try { keyStore().deleteEntry(KEY_ALIAS); keyStore().deleteEntry(TOKEN_KEY_ALIAS) } catch (_: Exception) { }
    }
}
