import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const variantId = searchParams.get("variant_id")

  if (!id) {
    return Response.json({ error: "id requerido" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("products")
    .select("status_id, stock_out")
    .eq("id", id)
    .single()

  let variantStockOut: boolean | null = null
  if (variantId) {
    const { data: variant } = await supabase
      .from("product_variants")
      .select("stock_out")
      .eq("id", variantId)
      .single()
    variantStockOut = variant?.stock_out ?? null
  }

  return Response.json({
    status_id: data?.status_id ?? null,
    stock_out: data?.stock_out ?? false,
    variant_stock_out: variantStockOut,
  })
}
