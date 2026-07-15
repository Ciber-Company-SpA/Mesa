import { NextResponse } from "next/server"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import { checkApiInventoryLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null

  if (!token) {
    return NextResponse.json({ error: "API key requerida" }, { status: 401 })
  }

  try {
    const { success } = await checkApiInventoryLimit(token)
    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá de nuevo en un momento." },
        { status: 429 }
      )
    }
  } catch (err) {
    logger.error("Rate limit no disponible en api_inventory_set_stock", err)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { ingredient_id, stock } = (body ?? {}) as {
    ingredient_id?: unknown
    stock?: unknown
  }

  if (typeof ingredient_id !== "number" || !Number.isFinite(ingredient_id)) {
    return NextResponse.json(
      { error: "ingredient_id requerido" },
      { status: 400 }
    )
  }

  if (typeof stock !== "number" || !Number.isFinite(stock)) {
    return NextResponse.json({ error: "stock requerido" }, { status: 400 })
  }

  const supabase = createSupabaseAnonClient()
  const { data, error } = await supabase.rpc("api_inventory_set_stock", {
    p_token: token,
    p_ingredient_id: ingredient_id,
    p_stock: stock,
  })

  if (error) {
    logger.error("api_inventory_set_stock error", error)
    return NextResponse.json({ error: "API key inválida o solicitud rechazada" }, { status: 400 })
  }

  return NextResponse.json({ updated: data })
}
