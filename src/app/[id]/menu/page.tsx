import { notFound, redirect } from "next/navigation"
import { getMenuData } from "@/lib/menu/get-menu-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { MenuClient } from "./MenuClient"

export const revalidate = 300

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let menu
  try {
    menu = await getMenuData(id)
  } catch {
    notFound()
  }

  // Si un mesero (role_id=1) escanea el QR, lo mandamos al panel de control
  // con la mesa preseleccionada en vez de mostrarle el menú de cliente.
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role_id")
      .eq("auth_user_id", user.id)
      .single()
    if (profile?.role_id === 1) {
      const params = new URLSearchParams({
        tableId: String(menu.tableId),
        tableNumber: String(menu.tableNumber ?? ""),
      })
      redirect(`/waiter/control?${params.toString()}`)
    }
  }

  return <MenuClient qrCode={id} menu={menu} />
}