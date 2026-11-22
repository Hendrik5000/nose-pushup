package app.alo.miraagent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.media.AudioManager
import android.os.BatteryManager
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

class MiraGatewayService : Service() {
    companion object {
        private const val ACTION_STOP = "app.alo.miraagent.STOP"
        private const val CHANNEL_ID = "mira_device_connection"
        private const val NOTIFICATION_ID = 4201
    }

    private val handler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private val connectionGeneration = ConnectionGeneration()
    private var socket: WebSocket? = null
    private var retryMs = 1_000L
    private var stopped = false
    private var reconnectPending = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopConnection()
            stopSelf()
            return START_NOT_STICKY
        }

        if (!stopped && (socket != null || reconnectPending)) {
            updateNotification("Mira-Verbindung ist bereits aktiv")
            return START_STICKY
        }

        startForeground(NOTIFICATION_ID, notification("Verbindung wird hergestellt"))
        val identity = DeviceIdentityStore.load(this)
        if (identity == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        stopped = false
        connect(identity.first, identity.second, identity.third)
        return START_STICKY
    }

    private fun connect(deviceId: String, token: String, gatewayUrl: String) {
        if (stopped) return
        val generation = connectionGeneration.begin()
        val request = Request.Builder()
            .url(gatewayUrl.replaceFirst("https://", "wss://") + "/v1/ws")
            .header("Authorization", "Bearer $token")
            .header("X-Mira-Device", deviceId)
            .build()

        socket?.cancel()
        val newSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (!connectionGeneration.isCurrent(generation)) return
                handler.removeCallbacksAndMessages(null)
                reconnectPending = false
                retryMs = 1_000L
                updateNotification("Mit Mira Gateway verbunden")
                sendEnvelope(
                    webSocket,
                    "hello",
                    JSONObject()
                        .put("deviceId", deviceId)
                        .put("platform", "android")
                        .put("agentVersion", "0.1.0"),
                )
                scheduleHeartbeat(webSocket, generation)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (connectionGeneration.isCurrent(generation)) {
                    handleEnvelope(webSocket, text)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                if (connectionGeneration.isCurrent(generation)) {
                    webSocket.close(1000, null)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                handleSocketEnded(webSocket, generation, deviceId, token, gatewayUrl)
            }

            override fun onFailure(webSocket: WebSocket, error: Throwable, response: Response?) {
                if (!connectionGeneration.isCurrent(generation)) return
                updateNotification("Offline – erneuter Verbindungsversuch")
                handleSocketEnded(webSocket, generation, deviceId, token, gatewayUrl)
            }
        })
        socket = newSocket
    }

    private fun handleSocketEnded(
        webSocket: WebSocket,
        generation: Long,
        deviceId: String,
        token: String,
        gatewayUrl: String,
    ) {
        if (!connectionGeneration.isCurrent(generation)) return
        if (socket === webSocket) socket = null
        scheduleReconnect(generation, deviceId, token, gatewayUrl)
    }

    private fun scheduleHeartbeat(webSocket: WebSocket, generation: Long) {
        val heartbeat = object : Runnable {
            override fun run() {
                if (stopped || !connectionGeneration.isCurrent(generation)) return
                if (socket !== webSocket) return
                sendEnvelope(webSocket, "heartbeat")
                handler.postDelayed(this, 30_000L)
            }
        }
        handler.postDelayed(heartbeat, 30_000L)
    }

    private fun handleEnvelope(webSocket: WebSocket, raw: String) {
        if (socket !== webSocket) return
        try {
            val envelope = JSONObject(raw)
            when (envelope.optString("type")) {
                "heartbeat" -> Unit
                "not-aus" -> {
                    updateNotification("Not-Aus aktiv – Verbindung gestoppt")
                    stopConnection()
                    stopSelf()
                }
                "revoke" -> {
                    DeviceIdentityStore.clear(this)
                    updateNotification("Kopplung widerrufen")
                    stopConnection()
                    stopSelf()
                }
                "action.request" -> {
                    val payload = JSONObject(envelope.optString("payloadJson", "{}"))
                    val requestId = payload.optString("requestId")
                    if (requestId.isNotBlank()) {
                        val result = executeAllowedAction(payload)
                        sendEnvelope(
                            webSocket,
                            "action.result",
                            JSONObject()
                                .put("requestId", requestId)
                                .put("status", result.first)
                                .put("detail", result.second),
                        )
                    }
                }
            }
        } catch (_: Exception) {
            // Unknown or malformed messages never trigger a device action.
        }
    }

    /**
     * Android-safe first action set. Unsupported desktop-oriented tools are rejected
     * explicitly; no shell, AccessibilityService, arbitrary file access or app killing.
     */
    private fun executeAllowedAction(payload: JSONObject): Pair<String, String> {
        val toolId = payload.optString("toolId")
        val args = payload.optJSONObject("args") ?: JSONObject()
        return try {
            when (toolId) {
                "status.ping" -> "ok" to "online"
                "status.info" -> {
                    val battery = getSystemService(BATTERY_SERVICE) as BatteryManager
                    val batteryPercent = battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                    val info = "Android ${Build.VERSION.RELEASE}; ${Build.MANUFACTURER} ${Build.MODEL}; " +
                        "API ${Build.VERSION.SDK_INT}; Akku ${batteryPercent.coerceIn(0, 100)}%"
                    "ok" to info
                }
                "audio.lautstaerke" -> {
                    val percent = args.optInt("volumePercent", -1)
                    if (percent !in 0..100) {
                        "error" to "volumePercent muss zwischen 0 und 100 liegen."
                    } else {
                        val audio = getSystemService(AUDIO_SERVICE) as AudioManager
                        val maximum = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                        val target = (maximum * percent / 100.0).toInt()
                        audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
                        "ok" to "Lautstärke auf ${percent}% gesetzt."
                    }
                }
                "audio.stummschalten" -> {
                    if (!args.has("muted")) {
                        "error" to "Der Parameter 'muted' (true/false) fehlt."
                    } else {
                        val muted = args.optBoolean("muted")
                        val audio = getSystemService(AUDIO_SERVICE) as AudioManager
                        audio.adjustStreamVolume(
                            AudioManager.STREAM_MUSIC,
                            if (muted) AudioManager.ADJUST_MUTE else AudioManager.ADJUST_UNMUTE,
                            0,
                        )
                        "ok" to if (muted) "Medienlautstärke stummgeschaltet." else "Stummschaltung aufgehoben."
                    }
                }
                else -> "nicht-implementiert" to "Dieses Werkzeug ist auf Android noch nicht verfügbar."
            }
        } catch (error: SecurityException) {
            "error" to "Android hat die Aktion aus Sicherheitsgründen verweigert."
        } catch (_: Exception) {
            "error" to "Die Aktion konnte auf diesem Android-Gerät nicht ausgeführt werden."
        }
    }

    private fun sendEnvelope(webSocket: WebSocket, type: String, payload: JSONObject? = null) {
        if (socket !== webSocket) return
        val envelope = JSONObject()
            .put("version", 1)
            .put("id", UUID.randomUUID().toString())
            .put("type", type)
            .put("at", java.time.Instant.now().toString())
        if (payload != null) envelope.put("payloadJson", payload.toString())
        webSocket.send(envelope.toString())
    }

    private fun scheduleReconnect(
        generation: Long,
        deviceId: String,
        token: String,
        gatewayUrl: String,
    ) {
        if (stopped || !connectionGeneration.isCurrent(generation) || reconnectPending) return
        reconnectPending = true
        val delay = retryMs
        retryMs = (retryMs * 2).coerceAtMost(60_000L)
        handler.postDelayed({
            if (!connectionGeneration.isCurrent(generation)) return@postDelayed
            reconnectPending = false
            if (!stopped) connect(deviceId, token, gatewayUrl)
        }, delay)
    }

    private fun stopConnection() {
        stopped = true
        connectionGeneration.invalidate()
        handler.removeCallbacksAndMessages(null)
        reconnectPending = false
        socket?.close(1000, "vom-nutzer-getrennt")
        socket = null
    }

    private fun notification(text: String): Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this,
            1,
            Intent(this, MiraGatewayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("Mira Geräte-Agent")
            .setContentText(text)
            .setContentIntent(openApp)
            .setOngoing(true)
            .addAction(0, "Trennen", stop)
            .build()
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, notification(text))
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        "Mira-Geräteverbindung",
                        NotificationManager.IMPORTANCE_LOW,
                    ),
                )
        }
    }

    override fun onDestroy() {
        stopConnection()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
