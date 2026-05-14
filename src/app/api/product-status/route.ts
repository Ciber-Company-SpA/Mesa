import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  const { data } = await supabase.from("products").select("status_id").eq("id", id).single()
  return Response.json(data)
}