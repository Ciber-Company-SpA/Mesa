import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Route Handler en vez de Page para que el CDN de Vercel NUNCA cachee la
// respuesta. Las Pages, incluso con `dynamic = "force-dynamic"`, en algunos
// casos terminaban cacheando el redirect para usuarios anónimos y luego se
// servía ese mismo redirect a usuarios logueados.
export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  const { qrCode } = await params
  const origin = req.nextUrl.origin

  const supabase = await createSupabaseServerClient()

  const { data: qrRow } = await supabase
    .from("table_qr_codes")
    .select("id")
    .eq("qr_code", qrCode)
    .maybeSingle()

  if (!qrRow) {
    return new NextResponse("QR no válido", { status: 404 })
  }

  const { data: tableRow } = await supabase
    .from("tables")
    .select("id, table_number")
    .eq("qr_code_id", qrRow.id)
    .maybeSingle()

  if (!tableRow) {
    return new NextResponse("Mesa no encontrada", { status: 404 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role_id")
      .eq("auth_user_id", user.id)
      .maybeSingle()
    if (profile?.role_id === 1) {
      const sp = new URLSearchParams({
        tableId: String(tableRow.id),
        tableNumber: String(tableRow.table_number ?? ""),
      })
      const res = NextResponse.redirect(`${origin}/waiter/control?${sp.toString()}`)
      res.headers.set("Cache-Control", "no-store, max-age=0")
      return res
    }
  }

  const res = NextResponse.redirect(`${origin}/${qrCode}/menu`)
  res.headers.set("Cache-Control", "no-store, max-age=0")
  return res
}
