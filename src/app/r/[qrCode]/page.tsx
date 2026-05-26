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
  searchParams,
}: {
  params: Promise<{ qrCode: string }>
  searchParams: Promise<{ debug?: string }>
}) {
  const { qrCode } = await params
  const { debug } = await searchParams

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

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  let profile: { role_id: number | null } | null = null
  let profileError: string | null = null
  if (userResult.user) {
    const r = await supabase
      .from("users")
      .select("role_id")
      .eq("auth_user_id", userResult.user.id)
      .maybeSingle()
    profile = r.data
    profileError = r.error?.message ?? null
  }

  if (debug === "1") {
    return (
      <pre style={{ padding: 16, fontSize: 12, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(
          {
            qrCode,
            tableId: tableRow.id,
            tableNumber: tableRow.table_number,
            authUserId: userResult.user?.id ?? null,
            authEmail: userResult.user?.email ?? null,
            authError: userError?.message ?? null,
            profileRoleId: profile?.role_id ?? null,
            profileError,
            wouldRedirectTo:
              profile?.role_id === 1
                ? `/waiter/control?tableId=${tableRow.id}`
                : `/${qrCode}/menu`,
          },
          null,
          2
        )}
      </pre>
    )
  }

  if (userResult.user && profile?.role_id === 1) {
    const sp = new URLSearchParams({
      tableId: String(tableRow.id),
      tableNumber: String(tableRow.table_number ?? ""),
    })
    redirect(`/waiter/control?${sp.toString()}`)
  }

  redirect(`/${qrCode}/menu`)
}
