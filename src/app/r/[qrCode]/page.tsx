import { notFound, redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"


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

  const { data: qrRow, error: qrErr } = await supabase
    .from("table_qr_codes")
    .select("id")
    .eq("qr_code", qrCode)
    .maybeSingle()

  const { data: tableRow, error: tableErr } = qrRow
    ? await supabase
        .from("tables")
        .select("id, table_number")
        .eq("qr_code_id", qrRow.id)
        .maybeSingle()
    : { data: null, error: null }

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  let profileRoleId: number | null = null
  let profileError: string | null = null
  if (userResult.user) {
    const r = await supabase
      .from("users")
      .select("role_id")
      .eq("auth_user_id", userResult.user.id)
      .maybeSingle()
    profileRoleId = r.data?.role_id ?? null
    profileError = r.error?.message ?? null
  }

  if (debug === "1") {
    return (
      <div style={{ padding: 16, fontFamily: "monospace", fontSize: 14 }}>
        <h2 style={{ marginBottom: 12 }}>QR Debug</h2>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f4", padding: 12 }}>
          {JSON.stringify(
            {
              qrCode,
              qrRowFound: !!qrRow,
              qrError: qrErr?.message ?? null,
              tableId: tableRow?.id ?? null,
              tableNumber: tableRow?.table_number ?? null,
              tableError: tableErr?.message ?? null,
              authUserId: userResult.user?.id ?? null,
              authEmail: userResult.user?.email ?? null,
              authError: userError?.message ?? null,
              profileRoleId,
              profileError,
              wouldRedirectTo:
                userResult.user && profileRoleId === 1
                  ? `/waiter/control?tableId=${tableRow?.id}`
                  : `/${qrCode}/menu`,
            },
            null,
            2
          )}
        </pre>
      </div>
    )
  }

  if (!qrRow || !tableRow) notFound()

  if (userResult.user && profileRoleId === 1) {
    const sp = new URLSearchParams({
      tableId: String(tableRow.id),
      tableNumber: String(tableRow.table_number ?? ""),
    })
    redirect(`/waiter/control?${sp.toString()}`)
  }

  redirect(`/${qrCode}/menu`)
}
