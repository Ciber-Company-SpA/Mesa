


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."cart_add_item"("p_table_id" bigint, "p_product_id" bigint, "p_variant_id" bigint, "p_quantity" integer, "p_notes" "text", "p_added_by" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_restaurant_id bigint;
  v_price         int;
  v_qty           int;
  v_notes         text;
  v_existing_id   uuid;
begin
  v_restaurant_id := public.cart_validate_table(p_table_id);
  if v_restaurant_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  v_qty := coalesce(p_quantity, 1);
  if v_qty < 1 or v_qty > 20 then
    raise exception 'Cantidad inválida (1-20)';
  end if;

  v_notes := nullif(left(coalesce(p_notes, ''), 250), '');

  v_price := public.cart_resolve_price(v_restaurant_id, p_product_id, p_variant_id);
  if v_price is null then
    raise exception 'Producto o variante no pertenece al restaurante de la mesa';
  end if;

  -- Buscar fila idéntica (producto + variante + notas) en la misma mesa.
  select id into v_existing_id
  from public.table_cart_items
  where table_id = p_table_id
    and product_id = p_product_id
    and variant_id is not distinct from p_variant_id
    and notes is not distinct from v_notes
  limit 1;

  if v_existing_id is not null then
    update public.table_cart_items
    set quantity = quantity + v_qty
    where id = v_existing_id;
  else
    insert into public.table_cart_items
      (restaurant_id, table_id, product_id, variant_id, unit_price, quantity, notes, added_by)
    values
      (v_restaurant_id, p_table_id, p_product_id, p_variant_id, v_price, v_qty, v_notes,
       nullif(left(coalesce(p_added_by, ''), 100), ''));
  end if;
end;
$$;


ALTER FUNCTION "public"."cart_add_item"("p_table_id" bigint, "p_product_id" bigint, "p_variant_id" bigint, "p_quantity" integer, "p_notes" "text", "p_added_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_clear"("p_table_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if public.cart_validate_table(p_table_id) is null then
    raise exception 'Mesa no válida';
  end if;

  delete from public.table_cart_items where table_id = p_table_id;
end;
$$;


ALTER FUNCTION "public"."cart_clear"("p_table_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_remove_item"("p_row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_table_id bigint;
begin
  select table_id into v_table_id
  from public.table_cart_items
  where id = p_row_id;

  if v_table_id is null then
    return; -- ya no existe, nada que hacer
  end if;

  if public.cart_validate_table(v_table_id) is null then
    raise exception 'Mesa no válida';
  end if;

  delete from public.table_cart_items where id = p_row_id;
end;
$$;


ALTER FUNCTION "public"."cart_remove_item"("p_row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_resolve_price"("p_restaurant_id" bigint, "p_product_id" bigint, "p_variant_id" bigint) RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_price int;
begin
  if p_variant_id is not null then
    select pv.variant_price into v_price
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = p_variant_id
      and pv.product_id = p_product_id
      and p.restaurant_id = p_restaurant_id;
  else
    select p.product_price into v_price
    from public.products p
    where p.id = p_product_id
      and p.restaurant_id = p_restaurant_id;
  end if;

  return v_price;
end;
$$;


ALTER FUNCTION "public"."cart_resolve_price"("p_restaurant_id" bigint, "p_product_id" bigint, "p_variant_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_update_quantity"("p_row_id" "uuid", "p_quantity" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_table_id bigint;
begin
  select table_id into v_table_id
  from public.table_cart_items
  where id = p_row_id;

  if v_table_id is null then
    raise exception 'Ítem no encontrado';
  end if;

  if public.cart_validate_table(v_table_id) is null then
    raise exception 'Mesa no válida';
  end if;

  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'Cantidad inválida (1-20)';
  end if;

  update public.table_cart_items
  set quantity = p_quantity
  where id = p_row_id;
end;
$$;


ALTER FUNCTION "public"."cart_update_quantity"("p_row_id" "uuid", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cart_validate_table"("p_table_id" bigint) RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select t.restaurant_id
  from public.tables t
  join public.table_qr_codes q on q.id = t.qr_code_id
  where t.id = p_table_id
    and q.qr_active = true
  limit 1;
$$;


ALTER FUNCTION "public"."cart_validate_table"("p_table_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_restaurant_setup"("p_restaurant_name" character varying) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_restaurant_id bigint;
begin
  if p_restaurant_name is null or length(trim(p_restaurant_name)) = 0 then
    raise exception 'Nombre de restaurante inválido';
  end if;

  select u.restaurant_id into v_restaurant_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.role_id = 2;

  if v_restaurant_id is null then
    raise exception 'No autorizado';
  end if;

  update public.restaurants
    set restaurant_name = trim(p_restaurant_name)
    where id = v_restaurant_id;

  update public.users
    set setup_completed = true
    where auth_user_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."complete_restaurant_setup"("p_restaurant_name" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_public_order"("p_table_id" bigint, "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_restaurant_id   bigint;
  v_order_id        bigint;
  v_initial_status  int;
  v_order_dest      text;
  v_item            jsonb;
  v_product_id      bigint;
  v_variant_id      bigint;
  v_qty             int;
  v_notes           text;
  v_unit_price      numeric;
  v_product_name    text;
  v_variant_name    text;
  v_product_status  int;
  v_total           numeric := 0;
  v_item_count      int;
  v_created_at      timestamptz;
  v_status_name     text;
begin
  -- Validar estructura y tamaño del pedido.
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items inválido';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 30 then
    raise exception 'El pedido debe tener entre 1 y 30 líneas';
  end if;

  -- Derivar restaurante desde la mesa y exigir QR activo.
  select t.restaurant_id
    into v_restaurant_id
  from public.tables t
  join public.table_qr_codes q on q.id = t.qr_code_id
  where t.id = p_table_id
    and q.qr_active = true;

  if v_restaurant_id is null then
    raise exception 'Mesa no encontrada o sin QR activo';
  end if;

  -- status inicial según order_destination del restaurante.
  select r.order_destination
    into v_order_dest
  from public.restaurants r
  where r.id = v_restaurant_id;

  v_initial_status := case when v_order_dest = 'kitchen' then 2 else 1 end;

  -- Crear la orden (total se recalcula y actualiza al final).
  insert into public.orders (table_id, restaurant_id, total, status_id, created_at)
  values (p_table_id, v_restaurant_id, 0, v_initial_status, now())
  returning id, created_at into v_order_id, v_created_at;

  -- Procesar cada línea recalculando todo desde la BD.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_variant_id := nullif(v_item->>'variant_id', '')::bigint;
    v_qty        := coalesce((v_item->>'quantity')::int, 0);
    v_notes      := left(coalesce(v_item->>'notes', ''), 250);

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Cantidad inválida (1-20) para product_id %', v_product_id;
    end if;

    -- Producto base: validar pertenencia + estado activo.
    select p.product_name, p.product_price, p.status_id
      into v_product_name, v_unit_price, v_product_status
    from public.products p
    where p.id = v_product_id
      and p.restaurant_id = v_restaurant_id;

    if v_product_name is null then
      raise exception 'Producto % no pertenece al restaurante de la mesa', v_product_id;
    end if;

    if v_product_status <> 1 then
      raise exception 'El producto "%" no está disponible', v_product_name;
    end if;

    v_variant_name := null;

    -- Variante (si la hay): validar pertenencia y tomar precio/nombre.
    if v_variant_id is not null then
      select pv.variant_price, pv.variant_name
        into v_unit_price, v_variant_name
      from public.product_variants pv
      where pv.id = v_variant_id
        and pv.product_id = v_product_id;

      if v_variant_name is null then
        raise exception 'La variante % no pertenece al producto %', v_variant_id, v_product_id;
      end if;
    end if;

    insert into public.order_items
      (order_id, product_id, product_quantity, product_name, product_price,
       notes, variant_id, variant_name)
    values
      (v_order_id, v_product_id, v_qty, v_product_name, v_unit_price,
       nullif(v_notes, ''), v_variant_id, v_variant_name);

    v_total := v_total + (v_unit_price * v_qty);
  end loop;

  -- Total real (orders.total es integer).
  update public.orders set total = round(v_total)::int where id = v_order_id;

  select s.status_name into v_status_name
  from public.order_status s
  where s.id = v_initial_status;

  return jsonb_build_object(
    'id',            v_order_id,
    'status_id',     v_initial_status,
    'status_name',   v_status_name,
    'created_at',    v_created_at,
    'table_id',      p_table_id,
    'restaurant_id', v_restaurant_id,
    'total',         round(v_total)::int
  );
end;
$$;


ALTER FUNCTION "public"."create_public_order"("p_table_id" bigint, "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid()
      and u.role_id = 2
  );
$$;


ALTER FUNCTION "public"."current_user_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_restaurant_id"() RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select u.restaurant_id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."current_user_restaurant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_admin_restaurant_id bigint;
  v_waiter_restaurant_id bigint;
  v_auth_user_id uuid;
begin
  select u.restaurant_id into v_admin_restaurant_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.role_id = 2;

  if v_admin_restaurant_id is null then
    raise exception 'No autorizado';
  end if;

  select u.restaurant_id, u.auth_user_id
    into v_waiter_restaurant_id, v_auth_user_id
  from public.users u
  where u.id = p_waiter_id
    and u.role_id = 1;

  if v_waiter_restaurant_id is null then
    raise exception 'Mesero no encontrado';
  end if;
  if v_waiter_restaurant_id <> v_admin_restaurant_id then
    raise exception 'No tienes permiso sobre este mesero';
  end if;

  delete from public.users where id = p_waiter_id;
  if v_auth_user_id is not null then
    delete from auth.users where id = v_auth_user_id;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) RETURNS TABLE("total_sales" numeric, "order_count" bigint)
    LANGUAGE "sql"
    AS $$
  SELECT COALESCE(SUM(total), 0), COUNT(*)
  FROM orders
  WHERE restaurant_id = restaurant_id_param
  AND created_at >= CURRENT_DATE
$$;


ALTER FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_report"("p_restaurant_id" bigint, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_granularity" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_summary jsonb;
  v_products jsonb;
  v_tables jsonb;
  v_timeline jsonb;
BEGIN
  IF p_granularity NOT IN ('hour','day','month') THEN
    RAISE EXCEPTION 'granularity must be hour, day, or month';
  END IF;

  SELECT jsonb_build_object(
    'totalRevenue', COALESCE(SUM(total), 0),
    'orderCount', COUNT(*),
    'averageTicket', COALESCE(AVG(total), 0)
  )
  INTO v_summary
  FROM orders
  WHERE restaurant_id = p_restaurant_id
    AND status_id = 4
    AND created_at >= p_from
    AND created_at < p_to;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t."unitsSold" DESC), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT
      oi.product_name AS "productName",
      oi.variant_name AS "variantName",
      SUM(oi.product_quantity)::int AS "unitsSold",
      SUM(oi.product_quantity * oi.product_price)::numeric AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.status_id = 4
      AND o.created_at >= p_from
      AND o.created_at < p_to
    GROUP BY oi.product_name, oi.variant_name
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.revenue DESC), '[]'::jsonb)
  INTO v_tables
  FROM (
    SELECT
      o.table_id AS "tableId",
      tb.table_number AS "tableNumber",
      COUNT(o.id)::int AS "orderCount",
      SUM(o.total)::numeric AS revenue
    FROM orders o
    LEFT JOIN tables tb ON tb.id = o.table_id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.status_id = 4
      AND o.created_at >= p_from
      AND o.created_at < p_to
      AND o.table_id IS NOT NULL
    GROUP BY o.table_id, tb.table_number
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.bucket), '[]'::jsonb)
  INTO v_timeline
  FROM (
    SELECT
      date_trunc(p_granularity, created_at) AS bucket,
      COUNT(*)::int AS "orderCount",
      SUM(total)::numeric AS revenue
    FROM orders
    WHERE restaurant_id = p_restaurant_id
      AND status_id = 4
      AND created_at >= p_from
      AND created_at < p_to
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'topProducts', v_products,
    'salesByTable', v_tables,
    'timeline', v_timeline
  );
END;
$$;


ALTER FUNCTION "public"."get_sales_report"("p_restaurant_id" bigint, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_granularity" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$declare
  new_restaurant_id bigint;
  v_role_id int;
  v_restaurant_id bigint;
begin
  v_role_id := coalesce((new.raw_user_meta_data->>'role_id')::int, 2);
  v_restaurant_id := (new.raw_user_meta_data->>'restaurant_id')::bigint;

  -- Si no viene restaurant_id, asumimos que es un registro nuevo de restaurante
  if v_restaurant_id is null then
    insert into public.restaurants (restaurant_name, restaurant_logo)
    values (
      coalesce(new.raw_user_meta_data->>'restaurant_name', 'Restaurante sin nombre'),
      null
    )
    returning id into new_restaurant_id;
  else
    new_restaurant_id := v_restaurant_id;
  end if;

  insert into public.users (
    auth_user_id, user_name, user_email, role_id, restaurant_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'admin_name', 'Nuevo Usuario'),
    new.email,
    v_role_id,
    new_restaurant_id
  );

  return new;
end;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_waiters_for_admin"() RETURNS TABLE("id" bigint, "user_name" "text", "user_email" "text", "role_id" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_admin_restaurant_id bigint;
begin
  select u.restaurant_id into v_admin_restaurant_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.role_id = 2;

  if v_admin_restaurant_id is null then
    raise exception 'No autorizado';
  end if;

  return query
    select u.id, u.user_name, u.user_email, u.role_id
    from public.users u
    where u.restaurant_id = v_admin_restaurant_id
      and u.role_id = 1
    order by u.id asc;
end;
$$;


ALTER FUNCTION "public"."list_waiters_for_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_ready_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_listo_id integer;
BEGIN
  SELECT id INTO v_listo_id
  FROM public.order_status
  WHERE lower(status_name) = 'listo'
  LIMIT 1;

  IF NEW.status_id = v_listo_id AND OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    NEW.ready_at := COALESCE(NEW.ready_at, now());
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_ready_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_table_cart_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_table_cart_items"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" bigint NOT NULL,
    "category_name" "text" NOT NULL,
    "restaurant_id" bigint
);

ALTER TABLE ONLY "public"."categories" REPLICA IDENTITY FULL;


ALTER TABLE "public"."categories" OWNER TO "postgres";


ALTER TABLE "public"."categories" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."categories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" integer NOT NULL,
    "table_id" integer
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


ALTER TABLE "public"."customers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" bigint NOT NULL,
    "order_id" bigint,
    "product_id" bigint,
    "product_quantity" integer DEFAULT 1 NOT NULL,
    "product_name" "text",
    "product_price" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "variant_id" bigint,
    "variant_name" "text"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


ALTER TABLE "public"."order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_status" (
    "id" integer NOT NULL,
    "status_name" "text" NOT NULL
);


ALTER TABLE "public"."order_status" OWNER TO "postgres";


ALTER TABLE "public"."order_status" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."order_status_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" bigint NOT NULL,
    "table_id" bigint,
    "total" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status_id" integer DEFAULT 1,
    "restaurant_id" bigint,
    "ready_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";


ALTER TABLE "public"."orders" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_status" (
    "id" integer NOT NULL,
    "status_name" "text" NOT NULL
);


ALTER TABLE "public"."product_status" OWNER TO "postgres";


ALTER TABLE "public"."product_status" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_status_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_variants" (
    "id" bigint NOT NULL,
    "product_id" bigint,
    "variant_name" character varying NOT NULL,
    "variant_price" integer NOT NULL,
    "variant_image" character varying,
    "variant_image_public_id" character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_variants" OWNER TO "postgres";


ALTER TABLE "public"."product_variants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."product_variants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "product_name" character varying NOT NULL,
    "product_description" "text",
    "product_price" integer NOT NULL,
    "product_image" character varying,
    "category_id" bigint,
    "restaurant_id" bigint,
    "status_id" integer DEFAULT 1,
    "product_image_public_id" character varying
);

ALTER TABLE ONLY "public"."products" REPLICA IDENTITY FULL;


ALTER TABLE "public"."products" OWNER TO "postgres";


ALTER TABLE "public"."products" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."table_qr_codes" (
    "id" bigint NOT NULL,
    "qr_code" "text" NOT NULL,
    "qr_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."table_qr_codes" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_qr_codes" OWNER TO "postgres";


ALTER TABLE "public"."table_qr_codes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."qr_codes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" bigint NOT NULL,
    "restaurant_name" character varying NOT NULL,
    "restaurant_logo" character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "menu_template" "text" DEFAULT 'noche'::"text" NOT NULL,
    "order_destination" "text" DEFAULT 'waiter'::"text" NOT NULL,
    "printer_bluetooth_name" "text",
    "output_mode" "text" DEFAULT 'none'::"text" NOT NULL,
    CONSTRAINT "restaurants_order_destination_check" CHECK (("order_destination" = ANY (ARRAY['waiter'::"text", 'kitchen'::"text"]))),
    CONSTRAINT "restaurants_output_mode_check" CHECK (("output_mode" = ANY (ARRAY['none'::"text", 'printer'::"text", 'screen'::"text"])))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


ALTER TABLE "public"."restaurants" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."restaurants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "nombre" "text" NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


ALTER TABLE "public"."roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."table_cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" bigint NOT NULL,
    "table_id" bigint NOT NULL,
    "product_id" bigint NOT NULL,
    "variant_id" bigint,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" integer NOT NULL,
    "notes" "text",
    "added_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "table_cart_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "table_cart_items_unit_price_check" CHECK (("unit_price" >= 0))
);


ALTER TABLE "public"."table_cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tables" (
    "id" bigint NOT NULL,
    "table_number" integer NOT NULL,
    "restaurant_id" bigint,
    "qr_code_id" bigint,
    "current_waiter_id" bigint
);

ALTER TABLE ONLY "public"."tables" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tables" OWNER TO "postgres";


ALTER TABLE "public"."tables" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tables_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" bigint NOT NULL,
    "user_name" "text",
    "user_email" "text",
    "role_id" integer DEFAULT 1,
    "restaurant_id" bigint,
    "auth_user_id" "uuid",
    "setup_completed" boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY "public"."users" REPLICA IDENTITY FULL;


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE "public"."users" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status"
    ADD CONSTRAINT "order_status_nombre_key" UNIQUE ("status_name");



ALTER TABLE ONLY "public"."order_status"
    ADD CONSTRAINT "order_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_status"
    ADD CONSTRAINT "product_status_nombre_key" UNIQUE ("status_name");



ALTER TABLE ONLY "public"."product_status"
    ADD CONSTRAINT "product_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_qr_codes"
    ADD CONSTRAINT "qr_codes_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."table_qr_codes"
    ADD CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_cart_items"
    ADD CONSTRAINT "table_cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_orders_reporting" ON "public"."orders" USING "btree" ("restaurant_id", "status_id", "created_at" DESC);



CREATE INDEX "idx_orders_restaurant_status_created" ON "public"."orders" USING "btree" ("restaurant_id", "status_id", "created_at");



CREATE INDEX "idx_table_cart_items_restaurant" ON "public"."table_cart_items" USING "btree" ("restaurant_id");



CREATE INDEX "idx_table_cart_items_table" ON "public"."table_cart_items" USING "btree" ("table_id");



CREATE INDEX "tables_current_waiter_idx" ON "public"."tables" USING "btree" ("current_waiter_id");



CREATE OR REPLACE TRIGGER "trg_orders_set_ready_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_ready_at"();



CREATE OR REPLACE TRIGGER "trg_table_cart_items_updated_at" BEFORE UPDATE ON "public"."table_cart_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_table_cart_items"();



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "fk_customer_table" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."order_status"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."product_status"("id");



ALTER TABLE ONLY "public"."table_cart_items"
    ADD CONSTRAINT "table_cart_items_product_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_cart_items"
    ADD CONSTRAINT "table_cart_items_restaurant_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_cart_items"
    ADD CONSTRAINT "table_cart_items_table_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_cart_items"
    ADD CONSTRAINT "table_cart_items_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_current_waiter_id_fkey" FOREIGN KEY ("current_waiter_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "public"."table_qr_codes"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



CREATE POLICY "Admin can update own restaurant" ON "public"."restaurants" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE (("users"."auth_user_id" = "auth"."uid"()) AND ("users"."role_id" = 2))))) WITH CHECK (("id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE (("users"."auth_user_id" = "auth"."uid"()) AND ("users"."role_id" = 2)))));



CREATE POLICY "Allow public insert restaurants" ON "public"."restaurants" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can select order_status" ON "public"."order_status" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "auth_user_id"));



CREATE POLICY "admin deletes own restaurant categories" ON "public"."categories" FOR DELETE TO "authenticated" USING ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin deletes own restaurant products" ON "public"."products" FOR DELETE TO "authenticated" USING ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin deletes own restaurant tables" ON "public"."tables" FOR DELETE TO "authenticated" USING ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin deletes variants of own products" ON "public"."product_variants" FOR DELETE TO "authenticated" USING (("public"."current_user_is_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_variants"."product_id") AND ("p"."restaurant_id" = "public"."current_user_restaurant_id"()))))));



CREATE POLICY "admin inserts own restaurant categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin inserts own restaurant products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin inserts own restaurant tables" ON "public"."tables" FOR INSERT TO "authenticated" WITH CHECK ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin inserts variants of own products" ON "public"."product_variants" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_is_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_variants"."product_id") AND ("p"."restaurant_id" = "public"."current_user_restaurant_id"()))))));



CREATE POLICY "admin updates own restaurant categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"())) WITH CHECK ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin updates own restaurant orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_id" = 2) AND ("u"."restaurant_id" = "orders"."restaurant_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_id" = 2) AND ("u"."restaurant_id" = "orders"."restaurant_id")))));



CREATE POLICY "admin updates own restaurant products" ON "public"."products" FOR UPDATE TO "authenticated" USING ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"())) WITH CHECK ((("restaurant_id" = "public"."current_user_restaurant_id"()) AND "public"."current_user_is_admin"()));



CREATE POLICY "admin updates variants of own products" ON "public"."product_variants" FOR UPDATE TO "authenticated" USING (("public"."current_user_is_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_variants"."product_id") AND ("p"."restaurant_id" = "public"."current_user_restaurant_id"())))))) WITH CHECK (("public"."current_user_is_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."products" "p"
  WHERE (("p"."id" = "product_variants"."product_id") AND ("p"."restaurant_id" = "public"."current_user_restaurant_id"()))))));



CREATE POLICY "cart no direct delete" ON "public"."table_cart_items" FOR DELETE TO "authenticated", "anon" USING (false);



CREATE POLICY "cart no direct insert" ON "public"."table_cart_items" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "cart no direct update" ON "public"."table_cart_items" FOR UPDATE TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "cart read for active table" ON "public"."table_cart_items" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."tables" "t"
     JOIN "public"."table_qr_codes" "q" ON (("q"."id" = "t"."qr_code_id")))
  WHERE (("t"."id" = "table_cart_items"."table_id") AND ("q"."qr_active" = true)))));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "customer_insert" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "customer_select" ON "public"."customers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "customer_update" ON "public"."customers" FOR UPDATE TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no direct insert orders" ON "public"."orders" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "no direct write order_items" ON "public"."order_items" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_select" ON "public"."products" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "qr_codes_delete" ON "public"."table_qr_codes" FOR DELETE TO "authenticated" USING (("id" IN ( SELECT "tables"."qr_code_id"
   FROM "public"."tables"
  WHERE ("tables"."restaurant_id" IN ( SELECT "users"."restaurant_id"
           FROM "public"."users"
          WHERE ("users"."auth_user_id" = "auth"."uid"()))))));



CREATE POLICY "qr_codes_select" ON "public"."table_qr_codes" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurants_select" ON "public"."restaurants" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_product_variants" ON "public"."product_variants" FOR SELECT USING (true);



CREATE POLICY "staff inserts qr codes" ON "public"."table_qr_codes" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_restaurant_id"() IS NOT NULL));



CREATE POLICY "staff reads own restaurant order_items" ON "public"."order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."users" "u" ON (("u"."restaurant_id" = "o"."restaurant_id")))
  WHERE (("o"."id" = "order_items"."order_id") AND ("u"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "staff reads own restaurant orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."restaurant_id" = "orders"."restaurant_id")))));



CREATE POLICY "staff updates own restaurant qr codes" ON "public"."table_qr_codes" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "t"."qr_code_id"
   FROM "public"."tables" "t"
  WHERE ("t"."restaurant_id" = "public"."current_user_restaurant_id"()))));



CREATE POLICY "staff updates own restaurant tables" ON "public"."tables" FOR UPDATE TO "authenticated" USING (("restaurant_id" = "public"."current_user_restaurant_id"())) WITH CHECK (("restaurant_id" = "public"."current_user_restaurant_id"()));



ALTER TABLE "public"."table_cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_qr_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tables_select" ON "public"."tables" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waiters can update orders in their restaurant" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_id" = 1) AND ("u"."restaurant_id" = "orders"."restaurant_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_id" = 1) AND ("u"."restaurant_id" = "orders"."restaurant_id")))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_add_item"("p_table_id" bigint, "p_product_id" bigint, "p_variant_id" bigint, "p_quantity" integer, "p_notes" "text", "p_added_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_add_item"("p_table_id" bigint, "p_product_id" bigint, "p_variant_id" bigint, "p_quantity" integer, "p_notes" "text", "p_added_by" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cart_add_item"("p_table_id" bigint, "p_product_id" bigint, "p_variant_id" bigint, "p_quantity" integer, "p_notes" "text", "p_added_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_add_item"("p_table_id" bigint, "p_product_id" bigint, "p_variant_id" bigint, "p_quantity" integer, "p_notes" "text", "p_added_by" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_clear"("p_table_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_clear"("p_table_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."cart_clear"("p_table_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_clear"("p_table_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_remove_item"("p_row_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_remove_item"("p_row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cart_remove_item"("p_row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_remove_item"("p_row_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_resolve_price"("p_restaurant_id" bigint, "p_product_id" bigint, "p_variant_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_resolve_price"("p_restaurant_id" bigint, "p_product_id" bigint, "p_variant_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."cart_resolve_price"("p_restaurant_id" bigint, "p_product_id" bigint, "p_variant_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_resolve_price"("p_restaurant_id" bigint, "p_product_id" bigint, "p_variant_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_update_quantity"("p_row_id" "uuid", "p_quantity" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_update_quantity"("p_row_id" "uuid", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cart_update_quantity"("p_row_id" "uuid", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_update_quantity"("p_row_id" "uuid", "p_quantity" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cart_validate_table"("p_table_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cart_validate_table"("p_table_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."cart_validate_table"("p_table_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cart_validate_table"("p_table_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_restaurant_setup"("p_restaurant_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."complete_restaurant_setup"("p_restaurant_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_restaurant_setup"("p_restaurant_name" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_public_order"("p_table_id" bigint, "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_public_order"("p_table_id" bigint, "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_public_order"("p_table_id" bigint, "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_public_order"("p_table_id" bigint, "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_is_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_user_is_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_user_restaurant_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_restaurant_id"() TO "service_role";
GRANT ALL ON FUNCTION "public"."current_user_restaurant_id"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_report"("p_restaurant_id" bigint, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_granularity" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_report"("p_restaurant_id" bigint, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_granularity" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_report"("p_restaurant_id" bigint, "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_granularity" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_waiters_for_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_waiters_for_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_waiters_for_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_ready_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_ready_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_ready_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_table_cart_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_table_cart_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_table_cart_items"() TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";
GRANT SELECT ON TABLE "public"."categories" TO "anon";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_status" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status" TO "service_role";
GRANT SELECT ON TABLE "public"."order_status" TO "anon";



GRANT ALL ON SEQUENCE "public"."order_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_status_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_status" TO "authenticated";
GRANT ALL ON TABLE "public"."product_status" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_status_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";
GRANT SELECT ON TABLE "public"."product_variants" TO "anon";



GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";
GRANT SELECT ON TABLE "public"."products" TO "anon";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."table_qr_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."table_qr_codes" TO "service_role";
GRANT SELECT ON TABLE "public"."table_qr_codes" TO "anon";



GRANT ALL ON SEQUENCE "public"."qr_codes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."qr_codes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."qr_codes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";
GRANT SELECT ON TABLE "public"."restaurants" TO "anon";



GRANT ALL ON SEQUENCE "public"."restaurants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."restaurants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."restaurants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."table_cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."table_cart_items" TO "service_role";
GRANT SELECT ON TABLE "public"."table_cart_items" TO "anon";



GRANT ALL ON TABLE "public"."tables" TO "authenticated";
GRANT ALL ON TABLE "public"."tables" TO "service_role";
GRANT SELECT ON TABLE "public"."tables" TO "anon";



GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







