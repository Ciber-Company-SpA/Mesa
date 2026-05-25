import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"

/**
 * Maneja el flujo de "establecer nueva contraseña" tras venir del link del
 * correo de recovery.
 *
 * Supabase puede entregar el token de dos formas según la versión / config:
 *  - Hash fragment: #access_token=...&refresh_token=...&type=recovery
 *  - Query param: ?code=... (PKCE flow)
 *
 * El cliente browser de Supabase con `detectSessionInUrl: true` (default)
 * procesa el hash automáticamente al cargar. Para PKCE, hay que llamar a
 * `exchangeCodeForSession(code)` explícitamente.
 *
 * Tras procesar el token el usuario tiene una "sesión de recovery" que
 * permite llamar `updateUser({password})`.
 */
export function useResetPassword() {
  const router = useRouter()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  // sessionReady: true cuando el token de recovery fue intercambiado y
  // tenemos sesión válida para llamar updateUser.
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const [sessionError, setSessionError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function prepareSession() {
      try {
        // PKCE flow: token en query param ?code=
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (cancelled) return
          if (exchangeError) {
            setSessionError("El link es inválido o expiró")
            setSessionReady(false)
            return
          }
          // Limpia el query param para que no quede expuesto en URL
          window.history.replaceState({}, "", url.pathname)
        }

        // Verificar que tenemos sesión (hash flow ya la habría procesado al cargar)
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return

        if (!session) {
          setSessionError("El link es inválido o expiró")
          setSessionReady(false)
          return
        }

        setSessionReady(true)
      } catch (err) {
        if (cancelled) return
        logger.error("Error procesando token de recovery", err)
        setSessionError("Error al verificar el link")
        setSessionReady(false)
      }
    }

    prepareSession()
    return () => { cancelled = true }
  }, [])

  async function submitNewPassword(e?: React.FormEvent) {
    e?.preventDefault()
    if (loading) return

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    try {
      setLoading(true)
      setError("")

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setDone(true)
      // Pequeño delay antes de redirigir para que el usuario vea el mensaje de éxito
      setTimeout(() => router.replace("/login"), 1200)
    } catch (err) {
      if (isNetworkError(err)) {
        setError("Sin conexión")
        return
      }
      logger.error("Error actualizando contraseña", err)
      setError("Error al actualizar la contraseña")
    } finally {
      setLoading(false)
    }
  }

  return {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    done,
    sessionReady,
    sessionError,
    submitNewPassword,
  }
}
