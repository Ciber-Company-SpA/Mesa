import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"


export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  const { qrCode } = await params


  const buildRedirect = (path: string) => {
    const url = new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? req.url)
    return url.toString()
  }

  const supabase = await createSupabaseServerClient()

  // RPC SECURITY DEFINER: anon ya no puede leer table_qr_codes/tables directo.
  // Devuelve la mesa solo si el token existe y el QR está activo.
  const { data: qrTable } = await supabase
    .rpc("resolve_qr_token", { p_qr_token: qrCode })
    .maybeSingle()

  const tableRow = qrTable as {
    table_id: number
    table_number: number | null
    restaurant_id: number
    current_waiter_id: number | null
  } | null

  if (!tableRow) {
    return new NextResponse("QR no válido", { status: 404 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("id, role_id, restaurant_id")
      .eq("auth_user_id", user.id)
      .maybeSingle()

  
    const sameRestaurant =
      profile?.restaurant_id != null && profile.restaurant_id === tableRow.restaurant_id

    if (profile?.role_id === 1 && profile.id && sameRestaurant) {

      if (tableRow.current_waiter_id == null) {
        await supabase
          .from("tables")
          .update({ current_waiter_id: profile.id })
          .eq("id", tableRow.table_id)
          .is("current_waiter_id", null)
      } else if (tableRow.current_waiter_id !== profile.id) {
        const res = NextResponse.redirect(
          buildRedirect(`/waiter/busy?tableNumber=${tableRow.table_number ?? ""}`)
        )
        res.headers.set("Cache-Control", "no-store, max-age=0")
        return res
      }

     
      const res = NextResponse.redirect(buildRedirect(`/waiter/control`))
      res.headers.set("Cache-Control", "no-store, max-age=0")
      return res
    }
  }

 
  const res = NextResponse.redirect(buildRedirect(`/${qrCode}/menu?from=scan`))
  res.headers.set("Cache-Control", "no-store, max-age=0")
  return res
}
