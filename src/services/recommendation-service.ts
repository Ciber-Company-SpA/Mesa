import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import { ok, fail, type Result } from "@/services/result"

export type RecommendedProduct = {
  id: number
  productName: string
  productImage: string | null
  productPrice: number
  statusId: number
  unitsSold: number
}

type RpcRow = {
  id: number
  product_name: string
  product_image: string | null
  product_price: number
  status_id: number
  units_sold: number
}

export async function getTopProductsToday(
  restaurantId: number,
  limit = 3
): Promise<Result<RecommendedProduct[]>> {
  if (!restaurantId || restaurantId <= 0) return fail("Restaurante inválido")

  const supabase = createSupabaseAnonClient()
  const { data, error } = await supabase.rpc("get_top_products_today", {
    p_restaurant_id: restaurantId,
    p_limit: limit,
  })
  if (error) return fail(error.message ?? "No se pudo cargar recomendaciones")

  const rows = (data as RpcRow[] | null) ?? []
  return ok(
    rows.map((r) => ({
      id: r.id,
      productName: r.product_name,
      productImage: r.product_image,
      productPrice: r.product_price,
      statusId: r.status_id,
      unitsSold: r.units_sold,
    }))
  )
}
