import { NextResponse } from "next/server"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null

  if (!token) {
    return NextResponse.json({ error: "API key requerida" }, { status: 401 })
  }

  const supabase = createSupabaseAnonClient()
  const { data, error } = await supabase.rpc("api_inventory_list", {
    p_token: token,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({ inventory: data })
}
