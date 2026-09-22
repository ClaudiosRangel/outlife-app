# Pesquisa — APIs de contexto regional para o Explorar

Levantamento (15/09/2026) de APIs que retornam "o que está acontecendo numa
região", para alimentar o painel "Panorama agora" do Explorar. Conclusões e
decisões abaixo. Conteúdo resumido/parafraseado das fontes (compliance).

## Conclusão rápida

Não existe **uma** API única, gratuita e sem cadastro que devolva "tudo que
está acontecendo" (eventos + clima + pessoas) para uso outdoor. A estratégia
vencedora é combinar:

1. **Clima/condições** → **Open-Meteo** (grátis, sem key). ✅ vamos usar.
2. **Eventos** → **os do próprio app** (tabela `events`), posicionados pela
   coordenada do destino. (APIs externas de evento são pagas/com key e não
   focam outdoor.)
3. **Pessoas/parceiros/destinos/trilhas** → dados internos do Supabase.

## Clima (escolhido: Open-Meteo)

- **Open-Meteo** — gratuito para uso não comercial, **sem API key, sem
  cadastro**, open-source; dados de serviços nacionais (NOAA, ECMWF, DWD).
  Endpoint por lat/lng retorna clima atual + previsão (até 16 dias).
  Fonte: open-meteo.com/en/docs e github.com/open-meteo/open-meteo.
  - Endpoint atual (exemplo):
    `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto`
  - Sem key → pode chamar direto do cliente. Uso não comercial; se o app
    virar comercial em escala, avaliar plano/atribuição.
- Alternativas (não escolhidas agora): Tomorrow.io (v4, alertas + eventos
  meteorológicos, exige key), Google Weather `publicAlerts` (alertas oficiais,
  exige key/faturamento), Visual Crossing (eventos de granizo/tornado/
  terremoto/incêndio, exige key), NOAA (grátis, foco EUA), xweather (free tier
  15k/mês, raios). Ficam como evolução se quisermos alertas severos.

## Eventos por região

- APIs públicas conhecidas (Eventbrite, Ticketmaster) exigem key, têm limites
  e não focam atividades outdoor. Não compensam agora.
- **Decisão:** usar os eventos do próprio app (`events` + `destination_id` →
  coords do destino, `event_date` para "próximos"). Quando houver volume,
  reavaliar integrações externas.

## Ideias futuras (registradas, não implementadas)

- Alertas meteorológicos severos (Open-Meteo tem `weather_code`; Tomorrow.io/
  Google têm alertas oficiais) → aviso de risco antes de sair para trilha.
- Qualidade do ar / índice UV (Open-Meteo tem endpoints de air-quality e UV).
- Fase da lua / horário do pôr do sol (Open-Meteo/астро) → planejamento.
- Condições de maré/ondas (surf) — Open-Meteo Marine API (grátis).
