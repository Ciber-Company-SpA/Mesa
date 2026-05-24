import { supabase } from "@/lib/supabase"
import { nanoid } from "nanoid"

type QrTable = "table_qr_codes"

export async function createQR(table: QrTable) {
  const qrCode = nanoid(8)

  const { data, error } = await supabase
    .from(table)
    .insert({ qr_code: qrCode, qr_active: true })
    .select()
    .single()

  if (error) throw error
  return data
}
