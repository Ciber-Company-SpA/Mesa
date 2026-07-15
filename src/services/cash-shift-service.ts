"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ok, fail, type Result } from "@/services/result"

export type CurrentShift = {
  id: number
  openedAt: string
  openingAmount: number
  sales: number
  tips: number
  orders: number
}

type CurrentShiftRpcResult = {
  id: number
  opened_at: string
  opening_amount: number
  sales: number
  tips: number
  orders: number
} | null

type CloseShiftRpcResult = {
  id: number
  expected: number
  closing: number
}

export async function getCurrentShift(): Promise<Result<CurrentShift | null>> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("get_current_cash_shift")

  if (error) return fail(error.message ?? "No se pudo obtener el turno actual")

  const result = data as CurrentShiftRpcResult
  if (!result || result.id == null) return ok(null)

  return ok({
    id: result.id,
    openedAt: result.opened_at,
    openingAmount: result.opening_amount ?? 0,
    sales: result.sales ?? 0,
    tips: result.tips ?? 0,
    orders: result.orders ?? 0,
  })
}

export async function openShift(opening: number): Promise<Result<{ id: number }>> {
  if (!Number.isFinite(opening) || opening < 0) return fail("Monto inicial inválido")

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("open_cash_shift", {
    p_opening: Math.round(opening),
  })

  if (error) return fail(error.message ?? "No se pudo abrir el turno")

  const id = data as number | null
  if (id == null) return fail("No se pudo abrir el turno")

  return ok({ id })
}

export async function closeShift(
  closing: number,
  notes: string
): Promise<Result<{ id: number; expected: number; closing: number }>> {
  if (!Number.isFinite(closing) || closing < 0) return fail("Monto contado inválido")

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("close_cash_shift", {
    p_closing: Math.round(closing),
    p_notes: notes ?? "",
  })

  if (error) return fail(error.message ?? "No se pudo cerrar el turno")

  const result = data as CloseShiftRpcResult | null
  if (!result || result.id == null) return fail("No se pudo cerrar el turno")

  return ok({
    id: result.id,
    expected: result.expected ?? 0,
    closing: result.closing ?? 0,
  })
}
