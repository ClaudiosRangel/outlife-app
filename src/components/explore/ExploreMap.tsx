import { lazy, Suspense } from "react";
import type { NowMarker } from "@/lib/nearby";

const MapView = lazy(() => import("@/components/MapView"));

/**
 * Mapa do Explorar (spec explorar-redesign).
 *
 * DECISÃO (após teste no APK): o `mapbox-gl` (WebGL) é instável no WebView
 * Android — cai em "WebGL context lost"/tela em branco e derrubava para um
 * fallback. Em vez de arriscar isso no app nativo (alvo das lojas), usamos o
 * **Leaflet com tiles raster do Mapbox** (estilo outdoors moderno) via
 * `MapView`, que é confiável no WebView e ainda entrega o visual Mapbox quando
 * há `VITE_MAPBOX_TOKEN`. Sem token, o `MapView` usa tiles do OpenStreetMap.
 *
 * A camada "agora" (amigos ao vivo + parceiros) é plotada pelo próprio
 * `MapView` (amigos/destinos) — os marcadores extras de parceiros entram via
 * a prop `extraMarkers`. O 3D real (WebGL) fica como evolução para o ambiente
 * de navegador, onde o WebGL é estável.
 */
export function ExploreMap({
  markers,
  selectedFriendId,
  onSelectedFriendUnavailable,
  onMarkerClick,
}: {
  markers: NowMarker[];
  center: { lat: number; lng: number } | null;
  selectedFriendId?: string | null;
  onSelectedFriendUnavailable?: (friendId: string) => void;
  onMarkerClick?: (m: NowMarker) => void;
}) {
  const fallback = <div className="mx-5 mb-3 h-72 rounded-3xl bg-gradient-sky shadow-card" />;
  return (
    <Suspense fallback={fallback}>
      <MapView
        selectedFriendId={selectedFriendId}
        onSelectedFriendUnavailable={onSelectedFriendUnavailable}
        extraMarkers={markers}
        onExtraMarkerClick={onMarkerClick}
      />
    </Suspense>
  );
}
