-- RPC público: top productos vendidos hoy en un restaurante.
-- Se usa desde el menú del cliente (anon) para mostrar recomendaciones.
-- "Hoy" = orders pagados (status_id = 4) con created_at en el día corriente
-- en la timezone del servidor. Si querés respetar zona horaria del restaurante
-- agregar una columna restaurants.timezone y ajustar el date_trunc.

CREATE OR REPLACE FUNCTION public.get_top_products_today(
  p_restaurant_id bigint,
  p_limit         int DEFAULT 3
) RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  FROM (
    SELECT
      p.id            AS id,
      p.product_name  AS product_name,
      p.product_image AS product_image,
      p.product_price AS product_price,
      p.status_id     AS status_id,
      SUM(oi.product_quantity)::int AS units_sold
    FROM public.order_items oi
    JOIN public.orders   o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.status_id IN (1, 2, 3, 4)
      AND o.created_at >= date_trunc('day', now())
      AND p.status_id = 1                  -- solo productos activos hoy
    GROUP BY p.id, p.product_name, p.product_image, p.product_price, p.status_id
    ORDER BY SUM(oi.product_quantity) DESC, p.product_name ASC
    LIMIT GREATEST(LEAST(p_limit, 10), 1)
  ) row;
$$;

ALTER FUNCTION public.get_top_products_today(bigint, int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_top_products_today(bigint, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_products_today(bigint, int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_products_today(bigint, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_products_today(bigint, int) TO service_role;
