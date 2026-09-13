// Captura um frame (print) de um vídeo para usar como imagem estática — ex.:
// fundo do banner de compartilhamento de um post de vídeo (Frente E/comunidade).
// Client-side, via <video> + <canvas>. Nunca lança para o chamador: em caso de
// falha (CORS, formato, timeout), rejeita a promise para o chamador decidir o
// fallback.

/** Captura o frame do vídeo no instante `atSeconds` e retorna um data URL (webp/jpeg). */
export function captureVideoFrame(
  videoUrl: string,
  atSeconds = 1,
  timeoutMs = 8000,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let done = false;
    const cleanup = () => {
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        // ignore
      }
    };
    const fail = (err: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => fail(new Error("Tempo esgotado ao capturar frame do vídeo.")), timeoutMs);

    const grab = () => {
      if (done) return;
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          fail(new Error("Vídeo sem dimensões para capturar frame."));
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail(new Error("Contexto 2D indisponível para capturar frame do vídeo."));
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        done = true;
        clearTimeout(timer);
        cleanup();
        resolve(dataUrl);
      } catch (e) {
        fail(e instanceof Error ? e : new Error(String(e)));
      }
    };

    video.onloadeddata = () => {
      // Busca o instante desejado (limitado à duração disponível).
      const target = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(atSeconds, Math.max(0, video.duration - 0.1))
        : atSeconds;
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        grab();
      };
      video.addEventListener("seeked", onSeeked);
      try {
        video.currentTime = target;
      } catch {
        // se não puder buscar, captura o frame atual
        grab();
      }
    };
    video.onerror = () => fail(new Error("Falha ao carregar o vídeo para captura de frame."));

    video.src = videoUrl;
  });
}
