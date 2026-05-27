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
      if (!isAdminRole(role)) {
        // Acceso cruzado: un mesero/cocina/caja intentó entrar a /admin.
        // Lo mandamos al login de admin sin cerrar su sesión; solo si
        // efectivamente se loguea como admin se reemplaza la sesión.
        router.replace("/login")
      }
    }
    checkRole()

    // Solo redirigir en logout explicito. Una `session` null transitoria
    // durante un refresh de token NO debe sacar al usuario; Supabase reintenta
    // por su cuenta y dispara SIGNED_OUT solo si realmente se invalido.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") router.replace("/login")
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return <>{children}</>
}