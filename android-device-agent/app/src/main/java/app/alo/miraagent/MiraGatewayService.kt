package app.alo.miraagent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
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
    private val client = OkHttpClient.Builder().pingInterval(25, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS).readTimeout(0, TimeUnit.MILLISECONDS).build()
    private var socket: WebSocket? = null
    private var retryMs = 1_000L
    private var stopped = false
    private var reconnectPending = false

    override fun onCreate() { super.onCreate(); createNotificationChannel() }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopConnection(); stopSelf(); return START_NOT_STICKY }
        startForeground(NOTIFICATION_ID, notification("Verbindung wird hergestellt"))
        val identity = DeviceIdentityStore.load(this)
        if (identity == null) { stopSelf(); return START_NOT_STICKY }
        stopped = false
        connect(identity.first, identity.second, identity.third)
        return START_STICKY
    }

    private fun connect(deviceId: String, token: String, gatewayUrl: String) {
        if (stopped) return
        val request = Request.Builder().url(gatewayUrl.replaceFirst("https://", "wss://") + "/v1/ws")
            .header("Authorization", "Bearer $token").header("X-Mira-Device", deviceId).build()
        socket?.cancel()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                handler.removeCallbacksAndMessages(null)
                reconnectPending = false
                retryMs = 1_000L
                updateNotification("Mit Mira Gateway verbunden")
                sendEnvelope(webSocket, "hello", JSONObject().put("deviceId", deviceId).put("platform", "android").put("agentVersion", "0.1.0"))
                scheduleHeartbeat(webSocket)
            }
            override fun onMessage(webSocket: WebSocket, text: String) { handleEnvelope(webSocket, text) }
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(1000, null) }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { scheduleReconnect(deviceId, token, gatewayUrl) }
            override fun onFailure(webSocket: WebSocket, error: Throwable, response: Response?) {
                updateNotification("Offline – erneuter Verbindungsversuch")
                scheduleReconnect(deviceId, token, gatewayUrl)
            }
        })
    }

    private fun scheduleHeartbeat(webSocket: WebSocket) {
        val heartbeat = object : Runnable {
            override fun run() {
                if (stopped || socket !== webSocket) return
                sendEnvelope(webSocket, "heartbeat")
                handler.postDelayed(this, 30_000L)
            }
        }
        handler.postDelayed(heartbeat, 30_000L)
    }

    private fun handleEnvelope(webSocket: WebSocket, raw: String) {
        try {
            val envelope = JSONObject(raw)
            when (envelope.optString("type")) {
                "heartbeat" -> sendEnvelope(webSocket, "heartbeat")
                "not-aus" -> { updateNotification("Not-Aus aktiv – Verbindung gestoppt"); stopConnection(); stopSelf() }
                "revoke" -> { DeviceIdentityStore.clear(this); updateNotification("Kopplung widerrufen"); stopConnection(); stopSelf() }
                "action.request" -> {
                    val payload = JSONObject(envelope.optString("payloadJson", "{}"))
                    val requestId = payload.optString("requestId")
                    if (requestId.isNotBlank()) sendEnvelope(webSocket, "action.result", JSONObject()
                        .put("requestId", requestId).put("status", "nicht-implementiert")
                        .put("detail", "Android-Agent: Steuerungswerkzeuge sind noch nicht freigegeben."))
                }
            }
        } catch (_: Exception) { /* Unknown or malformed messages never trigger a device action. */ }
    }

    private fun sendEnvelope(webSocket: WebSocket, type: String, payload: JSONObject? = null) {
        val envelope = JSONObject().put("version", 1).put("id", UUID.randomUUID().toString())
            .put("type", type).put("at", java.time.Instant.now().toString())
        if (payload != null) envelope.put("payloadJson", payload.toString())
        webSocket.send(envelope.toString())
    }

    private fun scheduleReconnect(deviceId: String, token: String, gatewayUrl: String) {
        if (stopped || reconnectPending) return
        reconnectPending = true
        val delay = retryMs
        retryMs = (retryMs * 2).coerceAtMost(60_000L)
        handler.postDelayed({
            reconnectPending = false
            if (!stopped) connect(deviceId, token, gatewayUrl)
        }, delay)
    }

    private fun stopConnection() {
        stopped = true
        handler.removeCallbacksAndMessages(null)
        reconnectPending = false
        socket?.close(1000, "vom-nutzer-getrennt")
        socket = null
    }

    private fun notification(text: String): Notification {
        val openApp = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 1, Intent(this, MiraGatewayService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("Mira Geräte-Agent").setContentText(text).setContentIntent(openApp)
            .setOngoing(true).addAction(0, "Trennen", stop).build()
    }

    private fun updateNotification(text: String) { getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(text)) }
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel(CHANNEL_ID, "Mira-Geräteverbindung", NotificationManager.IMPORTANCE_LOW))
    }
    override fun onDestroy() { stopConnection(); client.dispatcher.executorService.shutdown(); client.connectionPool.evictAll(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
}
