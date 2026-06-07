-- Reemplaza get_top_products_today para agrupar por producto + variante
-- (idéntico al reporte). Así "Pizza · Individual" y "Pizza · XL" cuentan
-- por separado.

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
      oi.variant_id   AS variant_id,
      COALESCE(pv.variant_name, oi.variant_name) AS variant_name,
      COALESCE(pv.variant_price, oi.product_price) AS unit_price,
      SUM(oi.product_quantity)::int AS units_sold
    FROM public.order_items oi
    JOIN public.orders   o  ON o.id = oi.order_id
    JOIN public.products p  ON p.id = oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.status_id IN (1, 2, 3, 4)
      AND o.created_at >= date_trunc('day', now())
      AND p.status_id = 1
    GROUP BY
      p.id, p.product_name, p.product_image,
      oi.variant_id, pv.variant_name, oi.variant_name,
      pv.variant_price, oi.product_price
    ORDER BY SUM(oi.product_quantity) DESC, p.product_name ASC
    LIMIT GREATEST(LEAST(p_limit, 10), 1)
  ) row;
$$;
