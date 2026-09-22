import { SafeImage } from "@/components/SafeImage";
import { SafeVideo } from "@/components/SafeVideo";
import type { CardMedia } from "@/lib/community-card";

/**
 * Carrossel horizontal (scroll-snap) das mídias do card: mapa, foto, vídeo.
 * Com 1 mídia, exibe sem controles (Req 5.2). Vídeo via SafeVideo (sem
 * autoplay, poster resolvido pelo pai) (Req 5.3).
 */
export function MediaCarousel({
  media,
  fallbackSrc,
  poster,
  onPressMain,
  mainAriaLabel,
}: {
  media: CardMedia[];
  fallbackSrc: string;
  /** Poster para o vídeo (foto/mapa do post). */
  poster?: string;
  /** Ação ao tocar numa mídia de imagem/mapa (ex.: abrir a atividade). */
  onPressMain?: () => void;
  mainAriaLabel?: string;
}) {
  if (media.length === 0) return null;

  if (media.length === 1) {
    return <MediaItem item={media[0]} fallbackSrc={fallbackSrc} poster={poster} onPress={onPressMain} ariaLabel={mainAriaLabel} />;
  }

  return (
    <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto scrollbar-hide">
      {media.map((m, i) => (
        <div key={`${m.kind}-${i}`} className="w-full shrink-0 snap-center">
          <MediaItem item={m} fallbackSrc={fallbackSrc} poster={poster} onPress={onPressMain} ariaLabel={mainAriaLabel} />
        </div>
      ))}
    </div>
  );
}

function MediaItem({
  item,
  fallbackSrc,
  poster,
  onPress,
  ariaLabel,
}: {
  item: CardMedia;
  fallbackSrc: string;
  poster?: string;
  onPress?: () => void;
  ariaLabel?: string;
}) {
  if (item.kind === "video") {
    return <SafeVideo src={item.url} posterSrc={poster} />;
  }
  return (
    <SafeImage
      src={item.url}
      alt=""
      fallbackSrc={fallbackSrc}
      onClick={onPress}
      ariaLabel={ariaLabel}
    />
  );
}
