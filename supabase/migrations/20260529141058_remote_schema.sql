


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
    "notes" "text"
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
    "menu_template" "text" DEFAULT 'noche'::"text" NOT NULL
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
    "auth_user_id" "uuid"
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
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



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



CREATE POLICY "Allow all on order_items" ON "public"."order_items" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public insert restaurants" ON "public"."restaurants" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert orders" ON "public"."orders" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can read restaurants" ON "public"."restaurants" FOR SELECT USING (true);



CREATE POLICY "Anyone can select order_status" ON "public"."order_status" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can select orders" ON "public"."orders" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Authenticated users can view restaurants" ON "public"."restaurants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create own restaurant categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create own restaurant products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (("restaurant_id" = ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own restaurant categories" ON "public"."categories" FOR DELETE TO "authenticated" USING (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own restaurant products" ON "public"."products" FOR DELETE TO "authenticated" USING (("restaurant_id" = ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own restaurant categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own restaurant products" ON "public"."products" FOR UPDATE TO "authenticated" USING (("restaurant_id" = ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own restaurant categories" ON "public"."categories" FOR SELECT TO "authenticated" USING (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own restaurant products" ON "public"."products" FOR SELECT TO "authenticated" USING (("restaurant_id" = ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "auth_user_id"));



CREATE POLICY "anon can delete cart items" ON "public"."table_cart_items" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "anon can insert cart items" ON "public"."table_cart_items" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "anon can read cart items" ON "public"."table_cart_items" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "anon can update cart items" ON "public"."table_cart_items" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "customer_insert" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "customer_select" ON "public"."customers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "customer_update" ON "public"."customers" FOR UPDATE TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_product_variants" ON "public"."product_variants" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "insert_product_variants" ON "public"."product_variants" FOR INSERT TO "authenticated" WITH CHECK (true);



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



CREATE POLICY "qr_codes_insert" ON "public"."table_qr_codes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "qr_codes_select" ON "public"."table_qr_codes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "qr_codes_update" ON "public"."table_qr_codes" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurants_select" ON "public"."restaurants" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_product_variants" ON "public"."product_variants" FOR SELECT USING (true);



ALTER TABLE "public"."table_cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table_qr_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tables_delete" ON "public"."tables" FOR DELETE TO "authenticated" USING (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tables_insert" ON "public"."tables" FOR INSERT TO "authenticated" WITH CHECK (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tables_select" ON "public"."tables" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "tables_update" ON "public"."tables" FOR UPDATE TO "authenticated" USING (("restaurant_id" IN ( SELECT "users"."restaurant_id"
   FROM "public"."users"
  WHERE ("users"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "update_product_variants" ON "public"."product_variants" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waiters can update orders in their restaurant" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_id" = 1) AND ("u"."restaurant_id" = "orders"."restaurant_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."role_id" = 1) AND ("u"."restaurant_id" = "orders"."restaurant_id")))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."categories";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."products";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."table_cart_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tables";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_waiter_as_admin"("p_waiter_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_stats_today"("restaurant_id_param" bigint) TO "service_role";



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


















GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_status" TO "anon";
GRANT ALL ON TABLE "public"."order_status" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_status_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_status" TO "anon";
GRANT ALL ON TABLE "public"."product_status" TO "authenticated";
GRANT ALL ON TABLE "public"."product_status" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_status_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_variants" TO "anon";
GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_variants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."table_qr_codes" TO "anon";
GRANT ALL ON TABLE "public"."table_qr_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."table_qr_codes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."qr_codes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."qr_codes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."qr_codes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."restaurants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."restaurants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."restaurants_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."table_cart_items" TO "anon";
GRANT ALL ON TABLE "public"."table_cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."table_cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."tables" TO "anon";
GRANT ALL ON TABLE "public"."tables" TO "authenticated";
GRANT ALL ON TABLE "public"."tables" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
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































