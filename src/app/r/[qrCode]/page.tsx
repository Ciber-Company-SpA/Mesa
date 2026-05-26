import { notFound, redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Ruta intermedia a la que apuntan los QR de mesa. Decide a dónde mandar al
// usuario según si hay sesión de mesero o no:
//   - waiter (role_id=1) logueado → /waiter/control con la mesa preseleccionada
//   - cualquier otro caso        → /<qrCode>/menu (vista cliente)
// Forzamos dinámico para que la decisión se evalúe en cada request (auth).
export const dynamic = "force-dynamic"

export default async function QrEntryPage({
  params,
}: {
  params: Promise<{ qrCode: string }>
}) {
  const { qrCode } = await params

  const supabase = await createSupabaseServerClient()

  const { data: qrRow } = await supabase
    .from("table_qr_codes")
    .select("id")
    .eq("qr_code", qrCode)
    .maybeSingle()

  if (!qrRow) notFound()

  const { data: tableRow } = await supabase
    .from("tables")
    .select("id, table_number")
    .eq("qr_code_id", qrRow.id)
    .maybeSingle()

  if (!tableRow) notFound()

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
      redirect(`/waiter/control?${sp.toString()}`)
    }
  }

  redirect(`/${qrCode}/menu`)
}
