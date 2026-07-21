"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getSessionClaims } from "@/lib/supabase/claims"
import { isAdminRole, roleIdToRole } from "@/lib/waiter-session"

export function KitchenGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // El KDS (/screen) lo ven admin/manager y también el rol cocina. Cualquier
    // otra sesión (mesero/caja/sin sesión) se manda al login de staff.
    async function checkRole() {
      const claims = await getSessionClaims(supabase)
      if (!claims) {
        router.replace("/waiter/login")
        return
      }
      const { data: profile } = await supabase
        .from("users")
        .select("role_id")
        .eq("auth_user_id", claims.userId)
        .single()
      const role = roleIdToRole(profile?.role_id ?? 1)
      if (!isAdminRole(role) && role !== "kitchen") {
        router.replace("/waiter/login")
      }
    }
    checkRole()

    // Solo redirigir en logout explicito. Una `session` null transitoria
    // durante un refresh de token NO debe sacar al usuario; Supabase reintenta
    // por su cuenta y dispara SIGNED_OUT solo si realmente se invalido.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") router.replace("/waiter/login")
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return <>{children}</>
}
