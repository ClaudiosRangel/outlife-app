-- ============================================================================
-- BUG REAL (ponto 1 — curtir comentário falhava): a RPC toggle_comment_like
-- declarava RETURNS TABLE(liked, likes_count) e, dentro dela, referências a
-- `likes_count` colidiam com a coluna de saída da TABLE → erro 42702
-- "column reference \"likes_count\" is ambiguous". Mantemos a MESMA assinatura
-- de retorno (liked, likes_count) para não quebrar o contrato, mas qualificamos
-- todas as referências de coluna (pc.likes_count / cl.*) e usamos variável
-- local _lc. Idempotente (mantém tipo de retorno → CREATE OR REPLACE funciona).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_comment_like(_comment_id uuid)
RETURNS TABLE (liked boolean, likes_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _exists boolean;
  _lc integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.comment_likes cl
    WHERE cl.comment_id = _comment_id AND cl.user_id = _uid
  ) INTO _exists;

  IF _exists THEN
    DELETE FROM public.comment_likes cl
    WHERE cl.comment_id = _comment_id AND cl.user_id = _uid;
    UPDATE public.post_comments pc
       SET likes_count = GREATEST(0, pc.likes_count - 1)
     WHERE pc.id = _comment_id
     RETURNING pc.likes_count INTO _lc;
    RETURN QUERY SELECT false AS liked, COALESCE(_lc, 0) AS likes_count;
  ELSE
    INSERT INTO public.comment_likes (comment_id, user_id)
    VALUES (_comment_id, _uid)
    ON CONFLICT (comment_id, user_id) DO NOTHING;
    UPDATE public.post_comments pc
       SET likes_count = pc.likes_count + 1
     WHERE pc.id = _comment_id
     RETURNING pc.likes_count INTO _lc;
    RETURN QUERY SELECT true AS liked, COALESCE(_lc, 0) AS likes_count;
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.toggle_comment_like(uuid) TO authenticated;
