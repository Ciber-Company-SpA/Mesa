-- Tokens FCM por dispositivo/usuario.
-- Un mismo usuario puede tener varios dispositivos. El token es UNIQUE por
-- dispositivo (FCM lo regenera si la app se reinstala o se borran datos).

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token       text   NOT NULL,
  platform    text   NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens(user_id);

-- RLS: usuario autenticado puede leer/insertar/borrar SUS propios tokens.
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_own_read ON public.device_tokens;
CREATE POLICY device_tokens_own_read ON public.device_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = device_tokens.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS device_tokens_own_insert ON public.device_tokens;
CREATE POLICY device_tokens_own_insert ON public.device_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = device_tokens.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS device_tokens_own_update ON public.device_tokens;
CREATE POLICY device_tokens_own_update ON public.device_tokens
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = device_tokens.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS device_tokens_own_delete ON public.device_tokens;
CREATE POLICY device_tokens_own_delete ON public.device_tokens
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = device_tokens.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- RPC SECURITY DEFINER que upsertea el token del usuario autenticado.
-- Más simple que armar el insert client-side y lidiar con la unicidad.
CREATE OR REPLACE FUNCTION public.register_device_token(
  p_token    text,
  p_platform text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_id bigint;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;
  IF p_platform NOT IN ('android', 'ios', 'web') THEN
    RAISE EXCEPTION 'Plataforma inválida';
  END IF;

  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.device_tokens (user_id, token, platform)
  VALUES (v_user_id, p_token, p_platform)
  ON CONFLICT (token) DO UPDATE
    SET user_id    = EXCLUDED.user_id,
        platform   = EXCLUDED.platform,
        updated_at = now();
END;
$$;

ALTER FUNCTION public.register_device_token(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.register_device_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_device_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_token(text, text) TO service_role;
