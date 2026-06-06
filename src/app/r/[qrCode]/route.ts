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
    .select("id, table_number, current_waiter_id, restaurant_id")
    .eq("qr_code_id", qrRow.id)
    .maybeSingle()

  if (!tableRow) {
    return new NextResponse("Mesa no encontrada", { status: 404 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("id, role_id, restaurant_id")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    // Mesero solo puede atender mesas de SU restaurante. Si escanea un QR de
    // otro restaurante, cae al fallback de menú (igual que sin sesión).
    const sameRestaurant =
      profile?.restaurant_id != null && profile.restaurant_id === tableRow.restaurant_id

    if (profile?.role_id === 1 && profile.id && sameRestaurant) {
      // Si la mesa está libre, este mesero la reclama. Si ya la atiende él
      // mismo, sigue de largo. Si la atiende otro, lo mandamos a la pantalla
      // de "mesa ocupada".
      if (tableRow.current_waiter_id == null) {
        await supabase
          .from("tables")
          .update({ current_waiter_id: profile.id })
          .eq("id", tableRow.id)
          .is("current_waiter_id", null) // evita race condition con otro escaneo simultáneo
      } else if (tableRow.current_waiter_id !== profile.id) {
        const res = NextResponse.redirect(
          buildRedirect(`/waiter/busy?tableNumber=${tableRow.table_number ?? ""}`)
        )
        res.headers.set("Cache-Control", "no-store, max-age=0")
        return res
      }

      // No mandamos tableId/tableNumber como query para no auto-filtrar la
      // vista a la última mesa escaneada. El reclamo ya quedó hecho en BD;
      // el mesero ve todas sus mesas y puede filtrar haciendo click en un chip.
      const res = NextResponse.redirect(buildRedirect(`/waiter/control`))
      res.headers.set("Cache-Control", "no-store, max-age=0")
      return res
    }
  }

  const res = NextResponse.redirect(buildRedirect(`/${qrCode}/menu`))
  res.headers.set("Cache-Control", "no-store, max-age=0")
  return res
}
