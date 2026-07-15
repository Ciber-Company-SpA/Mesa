import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ok, fail, type Result } from "@/services/result"

export type RequestBillResult = {
  status: "created" | "already_pending"
}

export type ServiceCallType = "bill" | "waiter"

export type RequestServiceCallResult = {
  status: "created" | "already_pending"
}

type RequestBillRpcResult = {
  status: "created" | "already_pending"
  id?: number
}

export async function requestBill(
  qrToken: string,
  dinerToken: string | null
): Promise<Result<RequestBillResult>> {
  if (!qrToken || qrToken.length < 32) return fail("Mesa inválida")

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("request_bill_qr", {
    p_qr_token: qrToken,
    p_diner_token: dinerToken ?? null,
  })

  if (error) {
    if (error.message?.includes("rate_limit_exceeded")) {
      return fail("Estás pidiendo la cuenta demasiado seguido. Espera un momento.")
    }
    return fail(error.message ?? "No se pudo pedir la cuenta")
  }

  const result = data as RequestBillRpcResult | null
  if (!result?.status) return fail("No se pudo pedir la cuenta")

  return ok({ status: result.status })
}

// Llamada de servicio unificada: cuenta (con propina sugerida opcional) o
// llamado al mesero. Usa la RPC request_service_call_qr.
export async function requestServiceCall(
  qrToken: string,
  dinerToken: string | null,
  callType: ServiceCallType,
  tip: number
): Promise<Result<RequestServiceCallResult>> {
  if (!qrToken || qrToken.length < 32) return fail("Mesa inválida")

  const fallbackMsg =
    callType === "waiter" ? "No se pudo llamar al mesero" : "No se pudo pedir la cuenta"

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("request_service_call_qr", {
    p_qr_token: qrToken,
    p_diner_token: dinerToken ?? null,
    p_call_type: callType,
    p_tip: Math.max(0, Math.round(tip || 0)),
  })

  if (error) {
    if (error.message?.includes("rate_limit_exceeded")) {
      return callType === "waiter"
        ? fail("Estás llamando al mesero demasiado seguido. Espera un momento.")
        : fail("Estás pidiendo la cuenta demasiado seguido. Espera un momento.")
    }
    return fail(error.message ?? fallbackMsg)
  }

  const result = data as RequestBillRpcResult | null
  if (!result?.status) return fail(fallbackMsg)

  return ok({ status: result.status })
}