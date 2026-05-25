import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"
import { isAdminRole, roleIdToRole } from "@/lib/waiter-session"

export function useLogin() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function login(e: React.FormEvent) {
    e.preventDefault()

    try {
      setLoading(true)
      setError("")

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) throw error
      if (!data.user) {
        setError("No se pudo iniciar sesión")
        return
      }

      // Rechazar credenciales de mesero/cocina/caja en este portal.
      const { data: profile } = await supabase
        .from("users")
        .select("role_id")
        .eq("auth_user_id", data.user.id)
        .single()
      const role = roleIdToRole(profile?.role_id ?? 1)
      if (!isAdminRole(role)) {
        await supabase.auth.signOut()
        setError("Esta cuenta no es de administrador. Ingresa en el portal de mesero.")
        return
      }

      router.push("/admin")
    } catch (err: unknown) {
      logger.error("Error en login", err)
      setError(
        isNetworkError(err)
          ? "Sin conexión. Revisa tu internet e intenta de nuevo."
          : "No se pudo iniciar sesión"
      )
    } finally {
      setLoading(false)
    }
  }

  return { email, setEmail, password, setPassword, loading, error, login }
}