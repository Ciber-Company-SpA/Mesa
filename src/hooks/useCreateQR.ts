import { supabase } from "@/lib/supabase"
import { nanoid } from "nanoid"

export async function createQR() {
  const { data, error } = await supabase
    .from("qr_codes")
    .insert({
      qr_code: nanoid(8),
      qr_active: true
    })
    .select()
    .single()

  if (error) throw error
  return data
}