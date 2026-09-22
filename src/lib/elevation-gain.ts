// Cálculo puro e incremental de ganho de elevação (elevation gain / altimetria),
// espelhando o método usado pela Strava para dispositivos SEM barômetro.
//
// Contexto (TASK 3): o app roda em WebView Android (Capacitor) e recebe
// altitude apenas do GPS — que é ruidosa (erro típico de ±10-30 m, oscilando
// rapidamente mesmo parado). A abordagem anterior somava toda subida > 2 m
// entre pontos consecutivos, o que acumulava ruído e SUPERESTIMAVA muito o
// ganho.
//
// A Strava documenta (support.strava.com — "Elevation on Strava FAQs",
// conteúdo parafraseado): a elevação é suavizada para remover ruído e há um
// THRESHOLD de subida sustentada — ~10 m para atividades SEM dados
// barométricos fortes e ~2 m COM barômetro — antes de somar ao total.
//
// Este módulo implementa exatamente isso, de forma pura e incremental
// (streaming), para casar com o fluxo de amostras do tracker:
//   1. Suaviza a altitude por média móvel de janela curta (reduz jitter).
//   2. Ignora amostras de baixa acurácia horizontal (altitude GPS ruim anda
//      junto de acurácia horizontal ruim).
//   3. Acumula ganho por HISTERESE: mantém um "nível de referência" e só
//      credita ganho quando a altitude suavizada sobe de forma SUSTENTADA
//      acima do threshold em relação ao último ponto baixo (vale) —
//      descidas apenas movem o vale para baixo, sem debitar do total.

/** Threshold padrão (m) de subida sustentada para GPS sem barômetro (Strava usa ~10 m). */
export const DEFAULT_GAIN_THRESHOLD_M = 10;
/** Tamanho padrão da janela de suavização (nº de amostras de altitude). */
export const DEFAULT_SMOOTHING_WINDOW = 5;
/** Acurácia horizontal (m) acima da qual a altitude é considerada não confiável. */
export const DEFAULT_MAX_ACCURACY_M = 35;

export interface ElevationGainOptions {
  /** Threshold de subida sustentada em metros. Padrão 10 (GPS sem barômetro). */
  thresholdMeters?: number;
  /** Janela de média móvel para suavizar a altitude. Padrão 5. */
  smoothingWindow?: number;
  /** Acurácia horizontal máxima aceita (m). Amostras piores são ignoradas. Padrão 35. */
  maxAccuracyMeters?: number;
}

export interface ElevationSample {
  /** Altitude em metros (do GPS). `null`/`undefined` = indisponível. */
  altitude: number | null | undefined;
  /** Acurácia horizontal em metros (opcional). Usada para descartar ruído. */
  accuracy?: number | null;
}

/**
 * Estado do acumulador de ganho de elevação. Imutável na interface: cada
 * amostra retorna um novo estado (funcional/testável). Serializável para
 * persistir/restaurar a atividade em andamento.
 */
export interface ElevationGainState {
  /** Ganho de elevação acumulado até agora, em metros. */
  gain: number;
  /** Buffer da janela de suavização (altitudes brutas recentes). */
  window: number[];
  /** Menor altitude suavizada observada desde o último crédito (vale atual). */
  valley: number | null;
  /** Última altitude suavizada (para continuidade). */
  lastSmoothed: number | null;
}

/** Estado inicial vazio do acumulador. */
export function createElevationGainState(): ElevationGainState {
  return { gain: 0, window: [], valley: null, lastSmoothed: null };
}

function resolveOptions(opts?: ElevationGainOptions): Required<ElevationGainOptions> {
  return {
    thresholdMeters:
      opts?.thresholdMeters != null && Number.isFinite(opts.thresholdMeters) && opts.thresholdMeters > 0
        ? opts.thresholdMeters
        : DEFAULT_GAIN_THRESHOLD_M,
    smoothingWindow:
      opts?.smoothingWindow != null && Number.isFinite(opts.smoothingWindow) && opts.smoothingWindow >= 1
        ? Math.floor(opts.smoothingWindow)
        : DEFAULT_SMOOTHING_WINDOW,
    maxAccuracyMeters:
      opts?.maxAccuracyMeters != null && Number.isFinite(opts.maxAccuracyMeters) && opts.maxAccuracyMeters > 0
        ? opts.maxAccuracyMeters
        : DEFAULT_MAX_ACCURACY_M,
  };
}

/**
 * Processa UMA amostra de altitude e retorna o novo estado do acumulador.
 * Função pura: não muta o estado recebido.
 *
 * Regras:
 * - Altitude ausente/não finita → amostra ignorada (estado inalterado).
 * - Acurácia horizontal pior que `maxAccuracyMeters` → ignorada (altitude GPS
 *   pouco confiável costuma vir junto de baixa acurácia).
 * - A altitude é suavizada por média móvel (janela `smoothingWindow`).
 * - Ganho por histerese: quando a altitude suavizada sobe `>= threshold`
 *   acima do vale corrente, credita a diferença e "sobe" o vale até o ponto
 *   atual (evita creditar de novo a mesma subida). Descidas só abaixam o vale.
 */
export function pushElevationSample(
  state: ElevationGainState,
  sample: ElevationSample,
  opts?: ElevationGainOptions,
): ElevationGainState {
  const { thresholdMeters, smoothingWindow, maxAccuracyMeters } = resolveOptions(opts);

  const alt = sample.altitude;
  if (alt == null || !Number.isFinite(alt)) return state;
  if (sample.accuracy != null && Number.isFinite(sample.accuracy) && sample.accuracy > maxAccuracyMeters) {
    return state;
  }

  // Atualiza janela de suavização.
  const window = [...state.window, alt];
  while (window.length > smoothingWindow) window.shift();
  const smoothed = window.reduce((a, b) => a + b, 0) / window.length;

  // Primeira amostra válida: inicializa vale e referência, sem creditar.
  if (state.valley == null) {
    return { gain: state.gain, window, valley: smoothed, lastSmoothed: smoothed };
  }

  let gain = state.gain;
  let valley = state.valley;

  if (smoothed < valley) {
    // Descida: baixa o vale (candidato a nova base de subida).
    valley = smoothed;
  } else if (smoothed - valley >= thresholdMeters) {
    // Subida sustentada acima do threshold: credita e sobe o vale ao ponto
    // atual, para não recontar o mesmo trecho.
    gain += smoothed - valley;
    valley = smoothed;
  }

  return { gain, window, valley, lastSmoothed: smoothed };
}

/**
 * Conveniência: calcula o ganho total a partir de uma sequência de amostras
 * (para recomputar a partir de um trajeto salvo, testes, etc.).
 */
export function computeElevationGain(
  samples: ElevationSample[],
  opts?: ElevationGainOptions,
): number {
  let state = createElevationGainState();
  for (const s of samples) state = pushElevationSample(state, s, opts);
  return state.gain;
}
