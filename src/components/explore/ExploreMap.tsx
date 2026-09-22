import { lazy, Suspense, useState } from "react";
import { hasMapbox } from "@/lib/map-config";
import type { NowMarker } from "@/lib/nearby";

const MapboxExploreMap = lazy(() => import("@/components/explore/MapboxExploreMap"));
const MapView = lazy(() => import("@/components/MapView"));

/**
 * Seletor de provider de mapa do Explorar (spec explorar-redesign). Usa Mapbox
 * GL quando há token e não houve erro; caso contrário cai no MapView
 * (Leaflet/OSM) — o fallback gratuito já existente. Property 1: fallback seguro.
 */
export function ExploreMap({
  markers,
  center,
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
  const [mapboxFailed, setMapboxFailed] = useState(false);
  const useMapbox = hasMapbox() && !mapboxFailed;

  const fallback = <div className="mx-5 mb-3 h-72 rounded-3xl bg-gradient-sky shadow-card" />;

  if (useMapbox) {
    return (
      <Suspense fallback={fallback}>
        <MapboxExploreMap
          markers={markers}
          center={center}
          onError={() => setMapboxFailed(true)}
          onMarkerClick={onMarkerClick}
        />
      </Suspense>
    );
  }

  // Fallback Leaflet/OSM (comportamento atual preservado).
  return (
    <Suspense fallback={fallback}>
      <MapView
        selectedFriendId={selectedFriendId}
        onSelectedFriendUnavailable={onSelectedFriendUnavailable}
      />
    </Suspense>
  );
}
