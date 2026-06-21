import { nanoid } from "nanoid"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ok, fail, type Result } from "@/services/result"

export type CreatedQRCode = {
  id: number
  qrCode: string
}

export async function createTableQR(): Promise<Result<CreatedQRCode>> {
  const supabase = await createSupabaseServerClient()

  const qrCode = nanoid(32)

  // Vía RPC SECURITY DEFINER: el INSERT ... RETURNING no puede leerse con la
  // policy de SELECT (el QR aún no está ligado a una mesa), así que el insert
  // directo fallaba. La RPC ignora RLS en el RETURNING.
  const { data, error } = await supabase.rpc("admin_create_table_qr", {
    p_qr_code: qrCode,
  })

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
