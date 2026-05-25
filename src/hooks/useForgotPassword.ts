import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"

export function useForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function requestReset(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return

    const trimmed = email.trim()
    if (!trimmed) {
      setError("Ingresa un correo válido")
      return
    }

    try {
      setLoading(true)
      setError("")

      const redirectTo = `${window.location.origin}/reset-password`

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo }
      )

      if (resetError) {
        // Supabase devuelve el mismo mensaje aunque el email no exista (anti-enumeración).
        // Si llega un error, suele ser de rate limit o config.
        logger.error("Error solicitando reset", resetError)
        setError(resetError.message ?? "No se pudo enviar el correo")
        return
      }

      setSent(true)
    } catch (err) {
      if (isNetworkError(err)) {
        setError("Sin conexión. Verifica tu internet.")
        return
      }
      logger.error("Error en forgot password", err)
      setError("Error al solicitar el reset")
    } finally {
      setLoading(false)
    }
  }

  return { email, setEmail, loading, error, sent, requestReset }
}
