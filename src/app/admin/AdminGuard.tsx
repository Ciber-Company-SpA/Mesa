"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { isAdminRole, roleIdToRole } from "@/lib/waiter-session"

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // Verifica rol al montar: si la sesión actual es de mesero/cocina/caja,
    // mandalo a /waiter/control en vez de dejarlo ver UI de admin con
    // queries que fallarán por RLS.
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }
      const { data: profile } = await supabase
        .from("users")
        .select("role_id")
        .eq("auth_user_id", user.id)
        .single()
      const role = roleIdToRole(profile?.role_id ?? 1)
      if (!isAdminRole(role)) router.replace("/waiter/control")
    }
    checkRole()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/login")
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return <>{children}</>
}