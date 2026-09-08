-- 20260821090000_live-activity-friends-view.sql
-- Feature: Amigos em Atividade ao Vivo
--
-- Este arquivo introduz, de forma idempotente, a camada de dados que expõe o
-- vínculo de "amigo em atividade ao vivo" para a Explore_Screen, preservando as
-- regras de privacidade/visibilidade e a janela de 24h já vigentes na
-- public.public_user_locations. NUNCA editar migrations já aplicadas — este é um
-- arquivo NOVO, posterior a 20260820090000_activity-elevation-and-finish-effects.sql
-- (Requirements 7.1, 7.2, 7.3).
--
-- ---------------------------------------------------------------------------
-- DECISÃO DE RLS (confirmada na tarefa 1.1 — ver verificacao-terreno.md)
-- ---------------------------------------------------------------------------
-- A tabela public.user_activities tem RLS habilitada e possui EXATAMENTE UMA
-- policy de SELECT:
--
--     CREATE POLICY "Users can view their own activities"
--       ON public.user_activities FOR SELECT
--       USING (auth.uid() = user_id);
--
-- Ou seja: o observador NÃO consegue ler linhas de user_activities de OUTROS
-- usuários — apenas as próprias (auth.uid() = user_id). Nenhuma policy de SELECT
-- adicional foi criada em migrations posteriores.
--
-- Consequência: a VIEW public_user_locations_live será criada com
-- security_invoker=on (exigência do Req 7.5). Um JOIN/LEFT JOIN LATERAL DIRETO
-- contra user_activities rodaria com as permissões do OBSERVADOR e, sob a RLS
-- acima, retornaria NULL para as atividades de qualquer amigo — o activity_type
-- viria sempre NULL e is_live sempre false para amigos, quebrando o Req 1.1.
--
-- Por isso o vínculo é resolvido por uma função SECURITY DEFINER
-- (public.live_activity_type, abaixo), seguindo o mesmo padrão comprovado de
-- public.are_friends (também SECURITY DEFINER SET search_path = public), em vez
-- de um JOIN direto na VIEW security_invoker. A função expõe APENAS o
-- activity_type da atividade in_progress mais recente — não vaza histórico,
-- distância, rota nem qualquer outra coluna. A visibilidade continua governada
-- pela própria VIEW security_invoker (modo public / friends+are_friends / self);
-- a função de vínculo não decide QUEM aparece, só devolve o tipo de atividade
-- quando existe uma in_progress para um usuário já visível.
-- ---------------------------------------------------------------------------

-- Função SECURITY DEFINER que encapsula o vínculo com a atividade in_progress
-- mais recente do usuário, sem vazar histórico (Requirements 1.3, 7.1, 7.2).
-- Idempotente via CREATE OR REPLACE FUNCTION.
CREATE OR REPLACE FUNCTION public.live_activity_type(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.activity_type
  FROM public.user_activities a
  WHERE a.user_id = _user_id
    AND a.status = 'in_progress'
  ORDER BY a.start_time DESC
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- VIEW public.public_user_locations_live (tarefa 2.2)
-- ---------------------------------------------------------------------------
-- VIEW IRMÃ (superset) de public.public_user_locations: expõe as MESMAS colunas
-- da VIEW existente MAIS o activity_type (resolvido via a função SECURITY DEFINER
-- acima) e um indicador is_live derivado. A VIEW existente public_user_locations
-- é PRESERVADA INTACTA (Req 7.3) — os consumidores atuais continuam funcionando;
-- esta VIEW nova é opt-in para a Explore_Screen.
--
-- Propriedades preservadas (Requirements 5.1, 5.2, 5.4, 7.5):
--   * WITH (security_invoker=on) — a VIEW roda com as permissões do OBSERVADOR,
--     de modo que quem aparece continua governado pela RLS + regras abaixo.
--   * Filtro de recência de 24h (location_updated_at > now() - interval '24 hours').
--   * Regras de visibilidade idênticas: modo public / (friends E amizade aceita
--     via are_friends(auth.uid(), p.id)) / o próprio usuário (p.id = auth.uid()).
--   * lat/lng/location_updated_at NOT NULL.
--
-- is_live (Requirements 1.1, 1.4, 5.3): derivado — verdadeiro somente quando há
-- uma atividade in_progress (activity_type não nulo) E a posição está dentro do
-- Live_Recency_Window de 120s. Nenhuma flag redundante em profiles (Req 1.5).
--
-- Idempotente via DROP VIEW IF EXISTS + CREATE VIEW (Req 7.2).
DROP VIEW IF EXISTS public.public_user_locations_live;
CREATE VIEW public.public_user_locations_live
WITH (security_invoker=on) AS
SELECT
  p.id,
  p.full_name,
  p.username,
  p.avatar_url,
  p.latitude,
  p.longitude,
  p.location_updated_at,
  p.location_sharing_mode,
  public.live_activity_type(p.id) AS activity_type,
  (
    public.live_activity_type(p.id) IS NOT NULL
    AND p.location_updated_at > (now() - interval '120 seconds')
  ) AS is_live
FROM public.profiles p
WHERE p.latitude IS NOT NULL
  AND p.longitude IS NOT NULL
  AND p.location_updated_at IS NOT NULL
  AND p.location_updated_at > (now() - interval '24 hours')
  AND (
    p.location_sharing_mode = 'public'
    OR (p.location_sharing_mode = 'friends' AND public.are_friends(auth.uid(), p.id))
    OR p.id = auth.uid()
  );

GRANT SELECT ON public.public_user_locations_live TO anon, authenticated;

-- Índice parcial de apoio (opcional, idempotente) que reforça exatamente o
-- filtro de public.live_activity_type (user_id + status = 'in_progress').
-- Barato e não conflita com o índice existente user_activities_user_start_idx
-- (user_id, start_time DESC), que já atende a ordenação por start_time.
CREATE INDEX IF NOT EXISTS idx_user_activities_user_status
  ON public.user_activities (user_id, status)
  WHERE status = 'in_progress';
