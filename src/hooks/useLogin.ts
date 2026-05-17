import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"

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

      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) throw error

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