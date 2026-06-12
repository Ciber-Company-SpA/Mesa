import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ok, fail, type Result } from "@/services/result"

export type RequestBillResult = {
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

  if (error) return fail(error.message ?? "No se pudo pedir la cuenta")

  const result = data as RequestBillRpcResult | null
  if (!result?.status) return fail("No se pudo pedir la cuenta")

  return ok({ status: result.status })
}
