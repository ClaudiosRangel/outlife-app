package com.outlife.capacitorlocationtracking

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Plugin Capacitor do Native_Location_Tracking_Module para Android
 * (Requirements 2.1-2.7), implementado como Foreground Service dedicado
 * (LocationTrackingForegroundService) com FusedLocationProviderClient.
 *
 * Contrato TypeScript (src/definitions.ts): requestBackgroundPermission,
 * checkBackgroundPermission, startTracking, stopTracking, e os eventos
 * `locationUpdate`/`permissionRevoked`.
 */
@CapacitorPlugin(
    name = "LocationTracking",
    permissions = [
        Permission(
            alias = "location",
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ]
        ),
        Permission(
            alias = "backgroundLocation",
            strings = [Manifest.permission.ACCESS_BACKGROUND_LOCATION]
        )
    ]
)
class LocationTrackingPlugin : Plugin() {

    companion object {
        // Referência estática para o serviço em execução notificar o
        // plugin (que por sua vez notifica os listeners JS), já que o
        // Android Service não tem acesso direto à instância do Plugin.
        private var instance: LocationTrackingPlugin? = null

        fun emitLocationUpdate(location: Location) {
            val plugin = instance ?: return
            val data = JSObject().apply {
                put("lat", location.latitude)
                put("lng", location.longitude)
                put("ts", location.time)
                put("accuracy", location.accuracy.toDouble())
            }
            plugin.notifyListeners("locationUpdate", data)
        }

        fun emitPermissionRevoked() {
            val plugin = instance ?: return
            plugin.notifyListeners("permissionRevoked", JSObject())
        }
    }

    override fun load() {
        super.load()
        instance = this
    }

    private fun hasBackgroundLocationGranted(): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val background = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Antes do Android 10, a permissão de foreground já cobre o uso em segundo plano.
        }
        return fine && background
    }

    @PluginMethod
    fun checkBackgroundPermission(call: PluginCall) {
        val result = JSObject()
        result.put("granted", hasBackgroundLocationGranted())
        call.resolve(result)
    }

    @PluginMethod
    fun requestBackgroundPermission(call: PluginCall) {
        if (hasBackgroundLocationGranted()) {
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
            return
        }
        // Solicita primeiro a permissão de localização em uso; a permissão
        // de segundo plano (Android 10+) é solicitada em seguida, pois o
        // sistema exige que a de uso já esteja concedida antes de exibir o
        // diálogo de "permitir todo o tempo".
        requestPermissionForAlias("location", call, "locationPermsCallback")
    }

    @PermissionCallback
    private fun locationPermsCallback(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            requestPermissionForAlias("backgroundLocation", call, "backgroundPermsCallback")
        } else {
            val result = JSObject()
            result.put("granted", hasBackgroundLocationGranted())
            call.resolve(result)
        }
    }

    @PermissionCallback
    private fun backgroundPermsCallback(call: PluginCall) {
        val result = JSObject()
        result.put("granted", hasBackgroundLocationGranted())
        call.resolve(result)
    }

    @PluginMethod
    fun startTracking(call: PluginCall) {
        if (!hasBackgroundLocationGranted()) {
            call.reject("Permissão de localização em segundo plano não concedida.")
            return
        }
        val minIntervalMs = call.getLong("minIntervalMs", 5000L) ?: 5000L
        val minDistanceMeters = (call.getFloat("minDistanceMeters") ?: 10f)

        val intent = Intent(context, LocationTrackingForegroundService::class.java).apply {
            putExtra(LocationTrackingForegroundService.EXTRA_MIN_INTERVAL_MS, minIntervalMs)
            putExtra(LocationTrackingForegroundService.EXTRA_MIN_DISTANCE_METERS, minDistanceMeters)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        val intent = Intent(context, LocationTrackingForegroundService::class.java)
        context.stopService(intent)
        call.resolve()
    }
}
