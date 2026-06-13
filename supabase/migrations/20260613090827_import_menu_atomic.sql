-- ============================================================================
-- IMPORT ATÓMICO: import_menu_bulk(p_payload jsonb)  (IMPORTANTE 🟠)
--
-- Problema:
--   bulkImportMenu inserta categorías, productos y variantes en bucles
--   separados desde la Server Action, sin transacción. Si falla a mitad,
--   queda un menú parcial (categorías creadas, algunos productos, otros no).
--
-- Solución:
--   Una sola RPC que hace TODOS los inserts dentro de la misma transacción
--   de función. Si algo falla, PostgreSQL revierte todo automáticamente:
--   o se importa el menú completo, o no se importa nada.
--
-- Las imágenes (remove.bg / Cloudinary) NO van aquí: son llamadas HTTP
-- externas que se resuelven ANTES en el service, con concurrencia limitada.
-- A esta RPC llegan las URLs ya resueltas dentro del payload.
--
-- Formato de p_payload (jsonb):
-- {
--   "categories": ["Bebidas", "Postres"],
--   "products": [
--     {
--       "name": "Café Latte",
--       "description": "…" | null,
--       "price": 3200,
--       "category_name": "Bebidas",
--       "image_url": "https://…" | null,
--       "image_public_id": "…" | null,
--       "variants": [ { "name": "Grande", "price": 3800 } ]
--     }
--   ]
-- }
--
-- Devuelve un jsonb con el resumen:
--   { categories_created, categories_reused, products_created,
--     variants_created, images_found }
-- ============================================================================

create or replace function public.import_menu_bulk(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id        bigint;
  v_role_id        int;
  v_restaurant_id  bigint;

  v_cat            text;
  v_cat_key        text;
  v_cat_id         bigint;

  v_product        jsonb;
  v_variant        jsonb;
  v_product_id     bigint;
  v_image_url      text;
  v_image_pubid    text;

  -- contadores del resumen
  v_categories_created int := 0;
  v_categories_reused  int := 0;
  v_products_created   int := 0;
  v_variants_created   int := 0;
  v_images_found       int := 0;

  -- mapa nombre(lower) -> id de categoría
  v_cat_map jsonb := '{}'::jsonb;
begin
  -- 1) Autorización: solo admin (role_id = 2) del restaurante.
  select id, role_id, restaurant_id
    into v_user_id, v_role_id, v_restaurant_id
  from public.users
  where auth_user_id = auth.uid();

  if v_user_id is null or v_role_id <> 2 or v_restaurant_id is null then
    raise exception 'No autorizado';
  end if;

  -- 2) Validación básica del payload.
  if p_payload is null
     or jsonb_typeof(p_payload->'products') <> 'array' then
    raise exception 'Payload inválido';
  end if;

  if jsonb_array_length(p_payload->'products') > 200 then
    raise exception 'Demasiados productos (máximo 200)';
  end if;

  -- 3) Cargar categorías existentes en el mapa (case-insensitive).
  for v_cat, v_cat_id in
    select category_name, id
    from public.categories
    where restaurant_id = v_restaurant_id
  loop
    v_cat_map := jsonb_set(
      v_cat_map,
      array[lower(btrim(v_cat))],
      to_jsonb(v_cat_id)
    );
  end loop;

  -- 4) Reunir todas las categorías a asegurar: las del array + las que
  --    aparezcan en category_name de cada producto.
  --    Crear las que falten.
  for v_cat in
    select distinct btrim(value)
    from (
      select jsonb_array_elements_text(coalesce(p_payload->'categories', '[]'::jsonb)) as value
      union all
      select (prod->>'category_name') as value
      from jsonb_array_elements(p_payload->'products') prod
    ) all_cats
    where btrim(value) <> ''
  loop
    v_cat_key := lower(v_cat);

    if v_cat_map ? v_cat_key then
      v_categories_reused := v_categories_reused + 1;
    else
      insert into public.categories (category_name, restaurant_id)
      values (v_cat, v_restaurant_id)
      returning id into v_cat_id;

      v_cat_map := jsonb_set(v_cat_map, array[v_cat_key], to_jsonb(v_cat_id));
      v_categories_created := v_categories_created + 1;
    end if;
  end loop;

  -- 5) Insertar productos + variantes.
  for v_product in
    select * from jsonb_array_elements(p_payload->'products')
  loop
    v_cat_key := lower(btrim(coalesce(v_product->>'category_name', '')));

    -- La categoría debe existir en el mapa (se aseguró en el paso 4).
    if not (v_cat_map ? v_cat_key) then
      raise exception 'Producto "%" sin categoría válida', coalesce(v_product->>'name', '?');
    end if;

    v_cat_id      := (v_cat_map->>v_cat_key)::bigint;
    v_image_url   := nullif(v_product->>'image_url', '');
    v_image_pubid := nullif(v_product->>'image_public_id', '');

    if v_image_url is not null then
      v_images_found := v_images_found + 1;
    end if;

    insert into public.products
      (product_name, product_description, product_price, product_image,
       product_image_public_id, category_id, restaurant_id, status_id)
    values (
      left(btrim(coalesce(v_product->>'name', '')), 80),
      nullif(btrim(coalesce(v_product->>'description', '')), ''),
      coalesce((v_product->>'price')::int, 0),
      v_image_url,
      v_image_pubid,
      v_cat_id,
      v_restaurant_id,
      1
    )
    returning id into v_product_id;

    v_products_created := v_products_created + 1;

    -- Variantes del producto (si trae).
    if jsonb_typeof(v_product->'variants') = 'array' then
      for v_variant in
        select * from jsonb_array_elements(v_product->'variants')
      loop
        insert into public.product_variants
          (product_id, variant_name, variant_price, variant_image, variant_image_public_id)
        values (
          v_product_id,
          left(btrim(coalesce(v_variant->>'name', '')), 60),
          coalesce((v_variant->>'price')::int, 0),
          null,
          null
        );
        v_variants_created := v_variants_created + 1;
      end loop;
    end if;
  end loop;

  -- 6) Resumen. Si llegamos aquí, TODO se insertó (o nada, si hubo excepción).
  return jsonb_build_object(
    'categories_created', v_categories_created,
    'categories_reused',  v_categories_reused,
    'products_created',   v_products_created,
    'variants_created',   v_variants_created,
    'images_found',       v_images_found
  );
end;
$$;

alter function public.import_menu_bulk(jsonb) owner to postgres;
revoke all on function public.import_menu_bulk(jsonb) from public;
grant execute on function public.import_menu_bulk(jsonb) to authenticated, service_role;