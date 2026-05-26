import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"


export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  const { qrCode } = await params

  // El request interno del proxy puede apuntar a localhost en produccion.
  // La URL publica configurada debe ser el origen de los redirects del QR.
  const buildRedirect = (path: string) => {
    const url = new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? req.url)
    return url.toString()
  }

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
      const res = NextResponse.redirect(buildRedirect(`/waiter/control?${sp.toString()}`))
      res.headers.set("Cache-Control", "no-store, max-age=0")
      return res
    }
  }

  const res = NextResponse.redirect(buildRedirect(`/${qrCode}/menu`))
  res.headers.set("Cache-Control", "no-store, max-age=0")
  return res
}
