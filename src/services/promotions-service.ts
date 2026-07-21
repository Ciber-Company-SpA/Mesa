import { supabase } from "@/lib/supabase"

// 'fixed' = combo de productos fijos (precio fijo). 'build' = "arma tu promo":
// el comensal elige, por grupo, entre min..max productos de una categoría.
export type PromoKind = "fixed" | "build"

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

// Un grupo de elección de una promo build (ancla a una categoría de la carta).
export type PromotionGroup = {
  id: number
  name: string
  category_id: number
  category_name: string
  min_select: number
  max_select: number
  sort_order: number
  available_count: number
}

export type Promotion = {
  id: number
  kind: PromoKind
  name: string
  description: string | null
  promo_price: number
  image_url: string | null
  active: boolean
  sort_order: number
  items: PromotionItem[]
  original_total: number
  groups: PromotionGroup[]
}

export type PromotionItemInput = {
  product_id: number
  variant_id: number | null
  quantity: number
}

export type PromotionGroupInput = {
  category_id: number
  name: string
  min_select: number
  max_select: number
  sort_order: number
}

export type PromotionInput = {
  id: number | null
  kind: PromoKind
  name: string
  description: string | null
  promo_price: number
  image_url: string | null
  active: boolean
  items: PromotionItemInput[]
  groups: PromotionGroupInput[]
}

// Producto de la carta para el selector del diálogo (con sus variantes).
export type SelectableVariant = { id: number; variant_name: string; variant_price: number }
export type SelectableProduct = {
  id: number
  product_name: string
  product_price: number
  category_id: number | null
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
    p_kind: input.kind,
    p_groups: input.groups,
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
    .select("id, product_name, product_price, category_id, product_variants(id, variant_name, variant_price)")
    .eq("restaurant_id", restaurantId)
    .order("product_name", { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id as number,
    product_name: p.product_name as string,
    product_price: p.product_price as number,
    category_id: (p.category_id as number | null) ?? null,
    variants: ((p.product_variants ?? []) as SelectableVariant[]).sort((a, b) =>
      a.variant_name.localeCompare(b.variant_name)
    ),
  }))
}
