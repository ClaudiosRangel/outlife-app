// Helper fino (não-puro, exige DOM) para ler a duração de um arquivo de vídeo
// antes do upload (spec video-atividade-comunidade, Req 2.2/2.5).
//
// A DECISÃO sobre a duração é pura e testável em `video-validation.ts`
// (`validateVideoDuration`); aqui só extraímos o número de segundos via um
// elemento <video> com `preload="metadata"` — sem decodificar o vídeo
// inteiro, só o cabeçalho de metadados (barato em memória).
//
// Retorna a duração em segundos, ou `NaN` se não for possível determinar
// (arquivo corrompido, formato sem metadados de duração, erro de carregamento).
// A política de "indeterminável = recusar" fica na validação pura.

export function readVideoDurationSeconds(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    // Ambiente sem DOM (SSR/testes): não há como medir — retorna NaN e deixa
    // a validação pura recusar por segurança.
    if (typeof document === "undefined" || typeof URL === "undefined") {
      resolve(Number.NaN);
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    const finish = (seconds: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(seconds);
    };

    // Guarda-chuva: se os metadados não chegarem em tempo hábil, recusa.
    const timeout = setTimeout(() => finish(Number.NaN), 15_000);

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      finish(video.duration);
    };
    video.onerror = () => {
      clearTimeout(timeout);
      finish(Number.NaN);
    };
    video.src = url;
  });
}
