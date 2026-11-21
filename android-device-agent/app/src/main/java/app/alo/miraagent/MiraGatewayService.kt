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
                "action.request" -> handleActionRequest(webSocket, envelope.optString("payloadJson", "{}"))
            }
        } catch (_: Exception) {
            // Unknown or malformed messages never trigger a device action.
        }
    }

    private fun handleActionRequest(webSocket: WebSocket, rawPayload: String) {
        try {
            val payload = JSONObject(rawPayload)
            val requestId = payload.optString("requestId").takeIf { it.isNotBlank() }
            val toolId = payload.optString("toolId").takeIf { it.isNotBlank() }
            val argsValue = payload.opt("args")
            val args = payload.optJSONObject("args")
            val argumentKeys = if (args == null) emptySet() else args.keys().asSequence().toSet()
            val confirmationValue = payload.opt("confirmationGranted")
            val confirmationGranted = confirmationValue is Boolean && confirmationValue
            val decision = ActionRequestPolicy.validate(
                requestId = requestId,
                toolId = toolId,
                argsAreObject = argsValue is JSONObject,
                argumentKeys = argumentKeys,
                confirmationGranted = confirmationGranted,
            )
            when (decision) {
                is ActionRequestDecision.ReadOnly -> {
                    val detail = when (decision.toolId) {
                        "status.ping" -> "Android-Agent erreichbar."
                        "status.info" -> deviceInfoSummary()
                        else -> return
                    }
                    sendActionResult(webSocket, decision.requestId, "ok", detail)
                }
                is ActionRequestDecision.Rejected -> {
                    if (requestId != null) {
                        sendActionResult(webSocket, requestId, decision.status, decision.detail)
                    }
                }
            }
        } catch (_: Exception) {
            // Ungültige Requests lösen niemals eine Geräteaktion aus.
        }
    }

    private fun deviceInfoSummary(): String {
        val manufacturer = Build.MANUFACTURER.orEmpty().take(60)
        val model = Build.MODEL.orEmpty().take(80)
        val release = Build.VERSION.RELEASE.orEmpty().take(30)
        return "$manufacturer $model · Android $release (API ${Build.VERSION.SDK_INT}) · Agent 0.1.0"
            .replace(Regex("[\\r\\n\\t]"), " ")
            .take(240)
    }

    private fun sendActionResult(webSocket: WebSocket, requestId: String, status: String, detail: String) {
        sendEnvelope(
            webSocket,
            "action.result",
            JSONObject()
                .put("requestId", requestId)
                .put("status", status)
                .put("detail", detail.take(500)),
        )
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
