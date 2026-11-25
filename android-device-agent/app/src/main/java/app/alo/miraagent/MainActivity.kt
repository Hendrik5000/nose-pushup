package app.alo.miraagent

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var status: TextView
    private lateinit var gateway: EditText
    private lateinit var code: EditText
    private lateinit var deviceName: EditText
    private var notificationPermissionRequested = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 48, 40, 32)
        }
        status = TextView(this).apply {
            text = "Mira Geräte-Agent ist nicht gekoppelt."
            textSize = 16f
        }
        gateway = field("https://dein-gateway.example")
        code = field("6-stelliger Kopplungscode")
        deviceName = field("Android-Gerät")
        val pairButton = Button(this).apply {
            text = "Sicher koppeln"
            setOnClickListener { pairDevice() }
        }
        val connectButton = Button(this).apply {
            text = "Verbindung starten"
            setOnClickListener {
                if (!requireVisibleNotifications()) return@setOnClickListener
                if (DeviceIdentityStore.load(this@MainActivity) == null) {
                    status.text = "Dieses Gerät ist noch nicht gekoppelt."
                } else {
                    ContextCompat.startForegroundService(
                        this@MainActivity,
                        Intent(this@MainActivity, MiraGatewayService::class.java),
                    )
                    status.text = "Verbindung wird gestartet."
                }
            }
        }
        val stopButton = Button(this).apply {
            text = "Verbindung trennen"
            setOnClickListener {
                stopService(Intent(this@MainActivity, MiraGatewayService::class.java))
                status.text = "Verbindung getrennt."
            }
        }
        layout.addView(TextView(this).apply {
            text = "Mira Geräte-Agent"
            textSize = 24f
        })
        layout.addView(TextView(this).apply {
            text = "Kopple dieses Android-Gerät über einen einmaligen Code aus Alo → Mira → Gerätesteuerung."
            textSize = 14f
        })
        layout.addView(gateway)
        layout.addView(code)
        layout.addView(deviceName)
        layout.addView(pairButton)
        layout.addView(connectButton)
        layout.addView(stopButton)
        layout.addView(status)
        setContentView(layout)
        DeviceIdentityStore.load(this)?.let {
            gateway.setText(it.third)
            status.text = "Gerät gekoppelt (${it.first.take(8)}…). Die Verbindung kann gestartet werden."
        } ?: DeviceIdentityStore.savedGatewayUrl(this)?.let {
            gateway.setText(it)
            status.text = "Kopplung ungültig. Bitte dieses Gerät erneut koppeln."
        }
    }

    private fun field(hintText: String) = EditText(this).apply {
        hint = hintText
        textSize = 16f
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
    }

    private fun requireVisibleNotifications(): Boolean {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            status.text = "Erlaube Mira-Gerätebenachrichtigungen, damit die aktive Verbindung sichtbar bleibt."
            if (!notificationPermissionRequested) {
                notificationPermissionRequested = true
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    1001,
                )
            } else {
                openNotificationSettings()
            }
            return false
        }
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            status.text = "Bitte aktiviere Benachrichtigungen für Mira Geräte-Agent."
            openNotificationSettings()
            return false
        }
        return true
    }

    private fun openNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            data = Uri.fromParts("package", packageName, null)
        }
        startActivity(intent)
    }

    private fun pairDevice() {
        if (!requireVisibleNotifications()) return
        val url = try {
            PairingClient.validateGatewayUrl(gateway.text.toString())
        } catch (error: Exception) {
            status.text = error.message ?: "Gateway-Adresse ungültig."
            return
        }
        status.text = "Kopplung wird sicher angefragt …"
        executor.execute {
            try {
                val result = PairingClient.pair(url, code.text.toString(), deviceName.text.toString())
                DeviceIdentityStore.save(this, result.deviceId, result.deviceToken, url)
                runOnUiThread {
                    ContextCompat.startForegroundService(
                        this,
                        Intent(this, MiraGatewayService::class.java),
                    )
                    status.text = "Gekoppelt. Die Verbindung wird mit sichtbarer Benachrichtigung gehalten."
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = error.message ?: "Kopplung fehlgeschlagen."
                }
            }
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }
}
