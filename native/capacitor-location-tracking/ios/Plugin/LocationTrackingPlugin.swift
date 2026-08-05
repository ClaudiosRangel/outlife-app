import Foundation
import Capacitor
import CoreLocation

/**
 * Plugin Capacitor do Native_Location_Tracking_Module para iOS
 * (Requirements 2.1, 2.2, 2.3, 2.6, 2.7), usando CLLocationManager com
 * allowsBackgroundLocationUpdates = true e desiredAccuracy alta, com
 * distância/intervalo mínimos equivalentes aos do Android (5s/10m,
 * aplicados por throttling manual já que CLLocationManager não expõe um
 * intervalo mínimo de tempo diretamente).
 *
 * Contrato TypeScript (src/definitions.ts): requestBackgroundPermission,
 * checkBackgroundPermission, startTracking, stopTracking, e os eventos
 * `locationUpdate`/`permissionRevoked`.
 */
@objc(LocationTrackingPlugin)
public class LocationTrackingPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "LocationTrackingPlugin"
    public let jsName = "LocationTracking"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestBackgroundPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkBackgroundPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTracking", returnType: CAPPluginReturnPromise)
    ]

    private let locationManager = CLLocationManager()
    private var minIntervalMs: Double = 5000
    private var minDistanceMeters: Double = 10
    private var lastEmittedAt: Date?
    private var lastAuthorizationStatus: CLAuthorizationStatus = .notDetermined
    private var isTracking = false

    override public func load() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        lastAuthorizationStatus = locationManager.authorizationStatus
    }

    private func isBackgroundAuthorized(_ status: CLAuthorizationStatus) -> Bool {
        return status == .authorizedAlways
    }

    @objc func checkBackgroundPermission(_ call: CAPPluginCall) {
        let status = locationManager.authorizationStatus
        call.resolve(["granted": isBackgroundAuthorized(status)])
    }

    @objc func requestBackgroundPermission(_ call: CAPPluginCall) {
        let status = locationManager.authorizationStatus
        if isBackgroundAuthorized(status) {
            call.resolve(["granted": true])
            return
        }
        pendingPermissionCall = call
        if status == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        } else {
            locationManager.requestAlwaysAuthorization()
        }
    }

    private var pendingPermissionCall: CAPPluginCall?

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus

        // Requirement 2.7: revogação de permissão durante rastreamento em
        // andamento interrompe a captura de novos pontos, sem descartar os
        // já persistidos (a preservação dos pontos é responsabilidade do
        // lado JS, que só recebe o evento `permissionRevoked`).
        if isTracking && isBackgroundAuthorized(lastAuthorizationStatus) && !isBackgroundAuthorized(status) {
            stopLocationUpdatesInternal()
            notifyListeners("permissionRevoked", data: [:])
        }
        lastAuthorizationStatus = status

        guard let call = pendingPermissionCall else { return }

        switch status {
        case .authorizedWhenInUse:
            // Ainda não é "Always" — solicita a elevação, necessária para
            // segundo plano confiável (Requirement 2.1/2.2/2.3).
            manager.requestAlwaysAuthorization()
        case .authorizedAlways:
            pendingPermissionCall = nil
            call.resolve(["granted": true])
        case .denied, .restricted:
            pendingPermissionCall = nil
            call.resolve(["granted": false])
        case .notDetermined:
            break
        @unknown default:
            pendingPermissionCall = nil
            call.resolve(["granted": false])
        }
    }

    @objc func startTracking(_ call: CAPPluginCall) {
        guard isBackgroundAuthorized(locationManager.authorizationStatus) else {
            call.reject("Permissão de localização em segundo plano não concedida.")
            return
        }
        minIntervalMs = call.getDouble("minIntervalMs") ?? 5000
        minDistanceMeters = call.getDouble("minDistanceMeters") ?? 10

        locationManager.distanceFilter = minDistanceMeters
        lastEmittedAt = nil
        isTracking = true
        locationManager.startUpdatingLocation()
        call.resolve()
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        stopLocationUpdatesInternal()
        call.resolve()
    }

    private func stopLocationUpdatesInternal() {
        isTracking = false
        locationManager.stopUpdatingLocation()
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard isTracking, let location = locations.last else { return }

        // CLLocationManager não expõe um intervalo mínimo de tempo
        // diretamente (apenas distanceFilter); aplicamos o throttling de
        // minIntervalMs manualmente para respeitar a mesma frequência
        // mínima usada no Android (Requirement 2.1: 1 ponto a cada 5s OU
        // 10m, o que ocorrer primeiro — então só descartamos por tempo
        // quando a distância também não tiver disparado o distanceFilter
        // do sistema; como o distanceFilter já filtra por distância antes
        // de nos entregar o callback, aqui só resta aplicar o piso de
        // tempo para não emitir eventos tempestivos demais quando o
        // dispositivo está parado).
        let now = Date()
        if let last = lastEmittedAt, now.timeIntervalSince(last) * 1000 < minIntervalMs {
            return
        }
        lastEmittedAt = now

        let point: [String: Any] = [
            "lat": location.coordinate.latitude,
            "lng": location.coordinate.longitude,
            "ts": location.timestamp.timeIntervalSince1970 * 1000,
            "accuracy": location.horizontalAccuracy
        ]
        notifyListeners("locationUpdate", data: point)
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Erros individuais de captura são ignorados: o tracking continua
        // ativo, consistente com o comportamento do fallback web
        // (LocationTrackingWeb) e do módulo Android.
    }
}
