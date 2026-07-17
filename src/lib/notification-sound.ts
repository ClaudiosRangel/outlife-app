// Toca um "bip" curto e discreto quando uma notificação nova chega
// (Requirement solicitado pelo usuário: "Nas notificações deve ter um
// alerta sonoro"). Gerado via Web Audio API em vez de um arquivo de áudio
// binário — evita adicionar um asset novo ao repositório só para isso e
// funciona em qualquer navegador moderno sem depender de rede.
//
// Falha silenciosamente em ambientes sem suporte (SSR, navegadores muito
// antigos, políticas de autoplay que bloqueiam áudio antes de qualquer
// interação do usuário) — o alerta sonoro é um extra, nunca deve quebrar
// a tela de notificações.
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Dois tons curtos e ascendentes (estilo "ding"), suave e não intrusivo.
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });

    // Fecha o contexto depois que os tons terminam, para não deixar
    // contextos de áudio abertos acumulando a cada notificação.
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Silencioso — ver comentário acima.
  }
}
