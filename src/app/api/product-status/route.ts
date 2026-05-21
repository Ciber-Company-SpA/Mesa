import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return Response.json({ error: "id requerido" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("products")
    .select("status_id")
    .eq("id", id)
    .single()

  return Response.json(data)
}