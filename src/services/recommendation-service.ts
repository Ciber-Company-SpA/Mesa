import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import { ok, fail, type Result } from "@/services/result"

export type RecommendedProduct = {
  id: number
  productName: string
  productImage: string | null
  variantId: number | null
  variantName: string | null
  unitPrice: number
  unitsSold: number
}

type RpcRow = {
  id: number
  product_name: string
  product_image: string | null
  variant_id: number | null
  variant_name: string | null
  unit_price: number
  units_sold: number
}

export async function getTopProductsToday(
  qrCode: string,
  limit = 3
): Promise<Result<RecommendedProduct[]>> {
  if (!qrCode) return fail("QR inválido")

  const supabase = createSupabaseAnonClient()
  // El restaurante y el inicio del día se derivan server-side del token QR;
  // el cliente no controla el restaurante ni la fecha (sin fuga entre tenants).
  const { data, error } = await supabase.rpc("get_top_products_today_qr", {
    p_qr_token: qrCode,
    p_limit: limit,
  })
  if (error) return fail(error.message ?? "No se pudo cargar recomendaciones")

  const rows = (data as RpcRow[] | null) ?? []
  return ok(
    rows.map((r) => ({
      id: r.id,
      productName: r.product_name,
      productImage: r.product_image,
      variantId: r.variant_id,
      variantName: r.variant_name,
      unitPrice: Number(r.unit_price),
      unitsSold: r.units_sold,
    }))
  )
}
