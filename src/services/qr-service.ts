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
    return fail("Error al crear el codigo QR")
  }

  return ok({
    id: data.id,
    qrCode: data.qr_code,
  })
}

export async function deleteTableQR(qrCodeId: number): Promise<Result<{ id: number }>> {
  if (!qrCodeId || qrCodeId <= 0) {
    return fail("ID de QR invalido")
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase
    .from("table_qr_codes")
    .delete()
    .eq("id", qrCodeId)

  if (error) {
    return fail("Error al eliminar el codigo QR")
  }

  return ok({ id: qrCodeId })
}
