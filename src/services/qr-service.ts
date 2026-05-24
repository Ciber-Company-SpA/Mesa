import { nanoid } from "nanoid"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ok, fail, type Result } from "@/services/result"

export type CreatedQRCode = {
  id: number
  qrCode: string
}

export async function createTableQR(): Promise<Result<CreatedQRCode>> {
  const supabase = await createSupabaseServerClient()

  const qrCode = nanoid(8)

  const { data, error } = await supabase
    .from("table_qr_codes")
    .insert({ qr_code: qrCode, qr_active: true })
    .select("id, qr_code")
    .single()

  if (error || !data) {
    return fail("Error al crear el código QR")
  }

  return ok({
    id: data.id,
    qrCode: data.qr_code,
  })
}

export async function deleteTableQR(qrCodeId: number): Promise<Result<{ id: number }>> {
  if (!qrCodeId || qrCodeId <= 0) {
    return fail("ID de QR inválido")
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("table_qr_codes")
    .delete()
    .eq("id", qrCodeId)

  if (error) {
    return fail("Error al eliminar el código QR")
  }

  return ok({ id: qrCodeId })
}

// TODO: deprecar cuando se elimine el flujo de pedidos con QR
export async function createOrderQR(): Promise<Result<{ qrCode: string }>> {
  const supabase = await createSupabaseServerClient()

  const qrCode = nanoid(8)

  const { error } = await supabase
    .from("order_qr_codes")
    .insert({ qr_code: qrCode, qr_active: true })

  if (error) {
    return fail("Error al crear el código QR del pedido")
  }

  return ok({ qrCode })
}