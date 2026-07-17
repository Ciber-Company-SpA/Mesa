"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ok, fail, type Result } from "@/services/result"

export type OnlinePayment = {
  id: number
  tableNumber: number | null
  amount: number
  tip: number
  status: string
  provider: string | null
  createdAt: string
  paidAt: string | null
}

type OnlinePaymentRow = {
  id: number
  table_number: number | null
  amount: number | null
  tip: number | null
  status: string | null
  provider: string | null
  created_at: string
  paid_at: string | null
}

// Pagos en línea de hoy del restaurante del staff. Ese dinero llega a la
// cuenta de la pasarela del restaurante (no al efectivo de caja).
export async function listOnlinePayments(): Promise<Result<OnlinePayment[]>> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("list_my_online_payments")

  if (error) return fail(error.message ?? "No se pudieron cargar los pagos en línea")

  const rows = (data ?? []) as OnlinePaymentRow[]
  return ok(
    rows.map((r) => ({
      id: r.id,
      tableNumber: r.table_number,
      amount: r.amount ?? 0,
      tip: r.tip ?? 0,
      status: r.status ?? "pending",
      provider: r.provider,
      createdAt: r.created_at,
      paidAt: r.paid_at,
    }))
  )
}
