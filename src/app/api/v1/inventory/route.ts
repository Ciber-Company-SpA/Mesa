import { NextResponse } from "next/server"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import { checkApiInventoryLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null

  if (!token) {
    return NextResponse.json({ error: "API key requerida" }, { status: 401 })
  }

  // Rate limit por IP + prefijo de la key: frena fuerza bruta de tokens y abuso.
  try {
    const { success } = await checkApiInventoryLimit(token)
    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá de nuevo en un momento." },
        { status: 429 }
      )
    }
  } catch (err) {
    // Fail-open: la API no debe caerse si el limitador no responde.
    logger.error("Rate limit no disponible en api_inventory_list", err)
  }

  const supabase = createSupabaseAnonClient()
  const { data, error } = await supabase.rpc("api_inventory_list", {
    p_token: token,
  })

  if (error) {
    // No propagamos el mensaje interno de Postgres al cliente.
    logger.error("api_inventory_list error", error)
    return NextResponse.json({ error: "API key inválida o solicitud rechazada" }, { status: 401 })
  }

  return NextResponse.json({ inventory: data })
}
