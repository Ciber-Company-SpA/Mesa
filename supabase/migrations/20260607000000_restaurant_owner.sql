-- Soporte para "1 usuario → N restaurantes".
--
-- Modelo:
--   * Se agrega `restaurants.owner_user_id` (FK a users(id)) que indica el
--     dueño del restaurante. Un mismo usuario puede ser dueño de varios.
--   * `users.restaurant_id` se mantiene como "restaurante activo actual"
--     del usuario, así nada del código actual (RLS, RPCs, queries) se rompe.
--     Cuando un admin cambie de restaurante solo se actualiza ese campo.
--   * Los meseros siguen igual: `users.restaurant_id` apunta al único
--     restaurante donde trabajan.
--
-- Backfill: para cada restaurante existente buscamos el primer usuario con
-- role_id = 2 (admin) cuyo users.restaurant_id coincida y lo dejamos como
-- dueño. Los restaurantes sin admin asociado quedan con owner_user_id = NULL
-- (no rompe nada — el campo es nullable).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_user_id bigint
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS restaurants_owner_user_id_idx
  ON public.restaurants(owner_user_id);

COMMENT ON COLUMN public.restaurants.owner_user_id IS
  'Usuario dueño del restaurante (rol admin). Un usuario puede ser dueño de varios restaurantes.';

-- Backfill: marcar al primer admin de cada restaurante como dueño.
UPDATE public.restaurants r
SET owner_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (u.restaurant_id)
    u.restaurant_id,
    u.id AS user_id
  FROM public.users u
  WHERE u.restaurant_id IS NOT NULL
    AND u.role_id = 2
  ORDER BY u.restaurant_id, u.id ASC
) sub
WHERE r.id = sub.restaurant_id
  AND r.owner_user_id IS NULL;

-- Helper RPC: lista los restaurantes del usuario autenticado (todos los que
-- posee + el que tiene activo, sin duplicados). Pensado para que el TSX
-- pueda armar un selector "cambiar de restaurante" más adelante.
CREATE OR REPLACE FUNCTION public.list_my_restaurants()
  RETURNS TABLE (
    id              bigint,
    restaurant_name text,
    restaurant_logo text,
    menu_template   text,
    is_active       boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  WITH me AS (
    SELECT u.id AS user_id, u.restaurant_id AS active_id
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1
  )
  SELECT r.id,
         r.restaurant_name,
         r.restaurant_logo,
         r.menu_template,
         (r.id = me.active_id) AS is_active
  FROM public.restaurants r, me
  WHERE r.owner_user_id = me.user_id
     OR r.id = me.active_id
  ORDER BY r.restaurant_name ASC;
$$;

ALTER FUNCTION public.list_my_restaurants() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_my_restaurants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_restaurants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_restaurants() TO service_role;

-- Helper RPC: cambia el restaurante activo del usuario. Solo permite hacerlo
-- si el usuario es dueño del restaurante destino (o ya está vinculado a él
-- vía users.restaurant_id, caso meseros que no necesitan cambiar).
CREATE OR REPLACE FUNCTION public.set_active_restaurant(p_restaurant_id bigint)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_id bigint;
  v_owns    boolean;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = p_restaurant_id
      AND owner_user_id = v_user_id
  ) INTO v_owns;

  IF NOT v_owns THEN
    RAISE EXCEPTION 'No sos dueño de ese restaurante';
  END IF;

  UPDATE public.users
  SET restaurant_id = p_restaurant_id
  WHERE id = v_user_id;
END;
$$;

ALTER FUNCTION public.set_active_restaurant(bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_active_restaurant(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_restaurant(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_restaurant(bigint) TO service_role;

-- Helper RPC: crea un nuevo restaurante para el usuario autenticado y lo deja
-- como dueño. NO cambia el restaurante activo (el TSX puede llamarlo y
-- después decidir si "cambiar al recién creado" o no).
CREATE OR REPLACE FUNCTION public.create_owned_restaurant(p_name text)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_id       bigint;
  v_role_id       int;
  v_restaurant_id bigint;
  v_name          text;
BEGIN
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  IF v_name IS NULL OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;

  SELECT id, role_id INTO v_user_id, v_role_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF v_user_id IS NULL OR v_role_id <> 2 THEN
    RAISE EXCEPTION 'Solo administradores pueden crear restaurantes';
  END IF;

  INSERT INTO public.restaurants (restaurant_name, owner_user_id)
  VALUES (v_name, v_user_id)
  RETURNING id INTO v_restaurant_id;

  RETURN v_restaurant_id;
END;
$$;

ALTER FUNCTION public.create_owned_restaurant(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_owned_restaurant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_owned_restaurant(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_owned_restaurant(text) TO service_role;
