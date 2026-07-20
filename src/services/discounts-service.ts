import { supabase } from "@/lib/supabase"

export type DiscountScope = "all" | "category" | "product"
export type DiscountType = "percent" | "amount"

export type DiscountCode = {
  id: number
  code: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  scope: DiscountScope
  scope_category_id: number | null
  scope_product_id: number | null
  days_of_week: number[] | null
  time_from: string | null // "HH:MM"
  time_to: string | null
  valid_from: string | null // "YYYY-MM-DD"
  valid_to: string | null
  min_order_amount: number | null
  usage_limit: number | null
  used_count: number
  active: boolean
  available_now: boolean
}

export type DiscountInput = {
  id: number | null
  code: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  scope: DiscountScope
  scope_category_id: number | null
  scope_product_id: number | null
  days_of_week: number[] | null
  time_from: string | null
  time_to: string | null
  valid_from: string | null
  valid_to: string | null
  min_order_amount: number | null
  usage_limit: number | null
  active: boolean
}

// Cupón vigente que ve el comensal (subconjunto).
export type AvailableCoupon = {
  id: number
  code: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  scope: DiscountScope
  scope_category_id: number | null
  scope_product_id: number | null
  min_order_amount: number | null
}

export async function listDiscounts(): Promise<DiscountCode[]> {
  const { data, error } = await supabase.rpc("discount_list")
  if (error) throw error
  return (data ?? []) as DiscountCode[]
}

export async function saveDiscount(input: DiscountInput): Promise<number> {
  const { data, error } = await supabase.rpc("discount_save", {
    p_id: input.id,
    p_code: input.code,
    p_description: input.description,
    p_discount_type: input.discount_type,
    p_discount_value: input.discount_value,
    p_scope: input.scope,
    p_scope_category_id: input.scope_category_id,
    p_scope_product_id: input.scope_product_id,
    p_days_of_week: input.days_of_week,
    p_time_from: input.time_from,
    p_time_to: input.time_to,
    p_valid_from: input.valid_from,
    p_valid_to: input.valid_to,
    p_min_order_amount: input.min_order_amount,
    p_usage_limit: input.usage_limit,
    p_active: input.active,
  })
  if (error) throw error
  return data as number
}

export async function setDiscountActive(id: number, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("discount_set_active", { p_id: id, p_active: active })
  if (error) throw error
}

export async function deleteDiscount(id: number): Promise<void> {
  const { error } = await supabase.rpc("discount_delete", { p_id: id })
  if (error) throw error
}

/** Cupones vigentes AHORA para el QR (los ve el comensal). */
export async function listAvailableCoupons(qrToken: string): Promise<AvailableCoupon[]> {
  const { data, error } = await supabase.rpc("list_available_coupons_qr", { p_qr_token: qrToken })
  if (error) throw error
  return (data ?? []) as AvailableCoupon[]
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

/** Descripción legible de las reglas de un cupón (para el admin). */
export function discountRuleSummary(d: DiscountCode): string {
  const parts: string[] = []
  parts.push(
    d.discount_type === "percent"
      ? `${d.discount_value}% de descuento`
      : `$${d.discount_value.toLocaleString("es-CL")} de descuento`
  )
  parts.push(
    d.scope === "all" ? "en toda la carta" : d.scope === "category" ? "en una categoría" : "en un producto"
  )
  if (d.days_of_week && d.days_of_week.length > 0 && d.days_of_week.length < 7) {
    parts.push(d.days_of_week.map((x) => DAY_LABELS[x]).join(", "))
  }
  if (d.time_from && d.time_to) parts.push(`${d.time_from}–${d.time_to}`)
  return parts.join(" · ")
}
