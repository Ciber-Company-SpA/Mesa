import { supabase } from "@/lib/supabase"
import { nanoid } from "nanoid"

export async function createQR() {
  const qrCode = nanoid(8)

  const { data, error } = await supabase
    .from("table_qr_codes")
    .insert({ qr_code: qrCode })
    .select()
    .single()

  if (error) throw error
  return data
}