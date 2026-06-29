import {
  CreateReservationSchema,
  CancelReservationSchema,
  type CreateReservationInput,
  type CancelReservationInput,
} from "@/lib/validation/reservation"
import { ok, fail, type Result } from "@/services/result"
import { requireCurrentAdmin } from "@/services/auth-guard"

export type CreatedReservation = {
  id: number
}

// ============ CREATE ============

export async function createReservation(
  input: CreateReservationInput
): Promise<Result<CreatedReservation>> {
  const validation = CreateReservationSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { tableId, customerName, startsAt, durationMinutes, customerPhone, partySize, notes } =
    validation.data

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth
  const { supabase } = auth.data

  // La RPC valida que la mesa sea del restaurante del admin, calcula ends_at y
  // rechaza solapamientos. Reusable por el bot de WhatsApp en Fase 2.
  const { data, error } = await supabase.rpc("create_reservation", {
    p_table_id: tableId,
    p_customer_name: customerName,
    p_starts_at: startsAt,
    p_duration_minutes: durationMinutes ?? null,
    p_customer_phone: customerPhone ?? null,
    p_party_size: partySize ?? null,
    p_source: "manual",
    p_notes: notes ?? null,
  })

  if (error) return fail(error.message ?? "No se pudo crear la reserva")

  const result = data as { id: number } | null
  if (!result?.id) return fail("No se pudo crear la reserva")

  return ok({ id: result.id })
}

// ============ CANCEL ============

export async function cancelReservation(
  input: CancelReservationInput
): Promise<Result<{ id: number }>> {
  const validation = CancelReservationSchema.safeParse(input)

  if (!validation.success) {
    return fail(validation.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { reservationId } = validation.data

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return auth
  const { supabase, restaurantId } = auth.data

  const { error } = await supabase
    .from("table_reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId)
    .eq("restaurant_id", restaurantId)

  if (error) return fail("No se pudo cancelar la reserva")

  return ok({ id: reservationId })
}
