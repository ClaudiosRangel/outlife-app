package com.outlife.capacitorlocationtracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Foreground Service dedicado ao Native_Location_Tracking_Module no Android
 * (Requirements 2.1, 2.2, 2.3, 2.4). Usa FusedLocationProviderClient com
 * PRIORITY_HIGH_ACCURACY, intervalo mínimo de 5s/10m, e mantém uma
 * notificação persistente no canal "Rastreamento ativo" enquanto o serviço
 * roda — obrigatório para foregroundServiceType="location" no Android 10+.
 *
 * Emite cada localização capturada via LocationTrackingPlugin.emitLocationUpdate,
 * que por sua vez notifica os listeners JS (`locationUpdate`).
 */
class LocationTrackingForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "outlife_location_tracking"
        const val NOTIFICATION_ID = 20260721
        const val EXTRA_MIN_INTERVAL_MS = "minIntervalMs"
        const val EXTRA_MIN_DISTANCE_METERS = "minDistanceMeters"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val minIntervalMs = intent?.getLongExtra(EXTRA_MIN_INTERVAL_MS, 5000L) ?: 5000L
        val minDistanceMeters = intent?.getFloatExtra(EXTRA_MIN_DISTANCE_METERS, 10f) ?: 10f

        startForeground(NOTIFICATION_ID, buildNotification())
        startLocationUpdates(minIntervalMs, minDistanceMeters)

        return START_STICKY
    }

    override fun onDestroy() {
        stopLocationUpdates()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startLocationUpdates(minIntervalMs: Long, minDistanceMeters: Float) {
        stopLocationUpdates()

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, minIntervalMs)
            .setMinUpdateIntervalMillis(minIntervalMs / 2) // Fastest interval = metade do intervalo normal
            .setMinUpdateDistanceMeters(minDistanceMeters)
            .setWaitForAccurateLocation(true) // Espera GPS preciso antes de enviar
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location: Location ->
                    LocationTrackingPlugin.emitLocationUpdate(location)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback as LocationCallback,
                mainLooper
            )
        } catch (e: SecurityException) {
            // Permissão de localização ausente/revogada: nada a fazer aqui —
            // LocationTrackingPlugin trata a checagem/solicitação de
            // permissão antes de iniciar o serviço (Requirement 2.6).
        }
    }

    private fun stopLocationUpdates() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Rastreamento ativo",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificação persistente exibida enquanto o rastreamento de atividade está ativo."
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE
        } else {
            0
        }
        val contentIntent = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(this, 0, it, pendingIntentFlags)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Rastreamento ativo")
            .setContentText("O Outlife está registrando sua atividade em segundo plano.")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .build()
    }
}
