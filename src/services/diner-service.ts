import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireStaffForRestaurant } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"

export type DinerSlot = {
  slot: number
  label: string
}

type ClaimDinerSlotRpcResult = {
  slot: number
  label: string
}

export async function claimDinerSlot(
  qrToken: string,
  token: string
): Promise<Result<DinerSlot>> {
  if (!qrToken || qrToken.length < 32) return fail("Mesa inválida")
  if (!token || token.length < 8) return fail("Token inválido")

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("claim_diner_slot_qr", {
    p_qr_token: qrToken,
    p_diner_token: token,
  })

  if (error) return fail(error.message ?? "No se pudo asignar comensal")

  const result = data as ClaimDinerSlotRpcResult | null
  if (!result || result.slot == null) return fail("No se pudo asignar comensal")

  return ok({ slot: result.slot, label: result.label })
}

export async function payDinerOrders(
  tableId: number,
  dinerSlot: number
): Promise<Result<{ paidIds: number[]; dinersCleared: boolean; tableReleased: boolean }>> {
  if (!tableId || tableId <= 0) return fail("Mesa inválida")
  if (!dinerSlot || dinerSlot <= 0) return fail("Comensal inválido")

  // Guard de sesión: solo personal del restaurante de la mesa. La RLS de
  // tables ya oculta la fila a anon y a staff de otros restaurantes.
  const supabase = await createSupabaseServerClient()
  const { data: tableRow, error: tableError } = await supabase
    .from("tables")
    .select("restaurant_id")
    .eq("id", tableId)
    .single()

  if (tableError || !tableRow) return fail("No autorizado")

  const auth = await requireStaffForRestaurant(tableRow.restaurant_id)
  if (!auth.ok) return fail(auth.error)

  const { data, error } = await supabase.rpc("pay_diner_orders", {
    p_table_id: tableId,
    p_diner_slot: dinerSlot,
  })

  if (error) return fail(error.message ?? "Error al cobrar al comensal")

  const result = data as {
    paid_ids: number[]
    diners_cleared: boolean
    table_released: boolean
  } | null

  return ok({
    paidIds: result?.paid_ids ?? [],
    dinersCleared: result?.diners_cleared ?? false,
    tableReleased: result?.table_released ?? false,
  })
}
