import { supabase } from "@/lib/supabase"

/**
 * Verifica que la mesa identificada por `qrCode` pertenezca al mismo
 * restaurante que el usuario autenticado (rol mesero).
 *
 * Devuelve un objeto explícito para que el caller pueda diferenciar entre:
 *  - QR válido + misma mesa → "ok"
 *  - QR válido + mesa de otro restaurante → "foreign-restaurant"
 *  - QR no existe en la DB → "unknown-qr"
 *  - Error de red / Supabase → "error"
 */
export type QrCheckResult =
  | { kind: "ok" }
  | { kind: "foreign-restaurant" }
  | { kind: "unknown-qr" }
  | { kind: "error" }

export async function checkQrBelongsToUserRestaurant(
  qrCode: string,
  authUserId: string
): Promise<QrCheckResult> {
  try {
    const [profileRes, qrRes] = await Promise.all([
      supabase
        .from("users")
        .select("restaurant_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle(),
      supabase
        .from("table_qr_codes")
        .select("id")
        .eq("qr_code", qrCode)
        .maybeSingle(),
    ])

    const userRestaurantId = profileRes.data?.restaurant_id
    const qrId = qrRes.data?.id

    if (!qrId) return { kind: "unknown-qr" }
    if (!userRestaurantId) return { kind: "error" }

    const { data: table } = await supabase
      .from("tables")
      .select("restaurant_id")
      .eq("qr_code_id", qrId)
      .maybeSingle()

    if (!table) return { kind: "unknown-qr" }

    return table.restaurant_id === userRestaurantId
      ? { kind: "ok" }
      : { kind: "foreign-restaurant" }
  } catch {
    return { kind: "error" }
  }
}
