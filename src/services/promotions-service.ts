import { supabase } from "@/lib/supabase"

// Una línea de la promoción (producto o variante), tal como la devuelve promo_list.
export type PromotionItem = {
  product_id: number
  variant_id: number | null
  quantity: number
  product_name: string
  variant_name: string | null
  unit_price: number
  available: boolean
}

export type Promotion = {
  id: number
  name: string
  description: string | null
  promo_price: number
  image_url: string | null
  active: boolean
  sort_order: number
  items: PromotionItem[]
  original_total: number
}

export type PromotionItemInput = {
  product_id: number
  variant_id: number | null
  quantity: number
}

export type PromotionInput = {
  id: number | null
  name: string
  description: string | null
  promo_price: number
  image_url: string | null
  active: boolean
  items: PromotionItemInput[]
}

// Producto de la carta para el selector del diálogo (con sus variantes).
export type SelectableVariant = { id: number; variant_name: string; variant_price: number }
export type SelectableProduct = {
  id: number
  product_name: string
  product_price: number
  variants: SelectableVariant[]
}

/** % de descuento de una promo respecto al precio original de carta (0-100). */
export function promoDiscountPct(originalTotal: number, promoPrice: number): number {
  if (!originalTotal || originalTotal <= 0) return 0
  const pct = Math.round((1 - promoPrice / originalTotal) * 100)
  return Math.max(0, Math.min(100, pct))
}

export async function listPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase.rpc("promo_list")
  if (error) throw error
  return (data ?? []) as Promotion[]
}

export async function savePromotion(input: PromotionInput): Promise<number> {
  const { data, error } = await supabase.rpc("promo_save", {
    p_id: input.id,
    p_name: input.name,
    p_description: input.description,
    p_promo_price: input.promo_price,
    p_image_url: input.image_url,
    p_active: input.active,
    p_items: input.items,
  })
  if (error) throw error
  return data as number
}

export async function setPromotionActive(id: number, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("promo_set_active", { p_id: id, p_active: active })
  if (error) throw error
}

export async function deletePromotion(id: number): Promise<void> {
  const { error } = await supabase.rpc("promo_delete", { p_id: id })
  if (error) throw error
}

/** Productos de la carta (con variantes) para armar una promoción. */
export async function listSelectableProducts(restaurantId: number): Promise<SelectableProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, product_name, product_price, product_variants(id, variant_name, variant_price)")
    .eq("restaurant_id", restaurantId)
    .order("product_name", { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id as number,
    product_name: p.product_name as string,
    product_price: p.product_price as number,
    variants: ((p.product_variants ?? []) as SelectableVariant[]).sort((a, b) =>
      a.variant_name.localeCompare(b.variant_name)
    ),
  }))
}
