"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export type PushStatus =
  | "idle"
  | "not-native"
  | "plugin-missing"
  | "permission-prompt"
  | "permission-denied"
  | "registering"
  | "registered"
  | "registration-error"
  | "rpc-error"

export type PushDiagnostics = {
  status: PushStatus
  message: string | null
}

/**
 * Registra el token FCM del dispositivo en `device_tokens` para que el backend
 * pueda enviarle push notifications cuando llegue un pedido nuevo.
 */
export function usePushRegistration(enabled: boolean): PushDiagnostics {
  const [diag, setDiag] = useState<PushDiagnostics>({ status: "idle", message: null })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let registrationListener: { remove?: () => void } | null = null
    let errorListener: { remove?: () => void } | null = null

    ;(async () => {
      let isNative = false
      try {
        const { Capacitor } = await import("@capacitor/core")
        isNative = Capacitor.isNativePlatform()
      } catch (err) {
        setDiag({ status: "not-native", message: `import core: ${String(err)}` })
        return
      }
      if (!isNative) {
        setDiag({ status: "not-native", message: "Capacitor.isNativePlatform() = false" })
        return
      }
      if (cancelled) return

      let PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications
      try {
        const mod = await import("@capacitor/push-notifications")
        PushNotifications = mod.PushNotifications
      } catch (err) {
        setDiag({ status: "plugin-missing", message: String(err) })
        logger.warn("Push plugin no disponible", { error: String(err) })
        return
      }

      try {
        setDiag({ status: "permission-prompt", message: "checking…" })
        let perm = await PushNotifications.checkPermissions()
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions()
        }
        if (perm.receive !== "granted") {
          setDiag({ status: "permission-denied", message: `receive=${perm.receive}` })
          return
        }

        setDiag({ status: "registering", message: "registrando…" })

        registrationListener = await PushNotifications.addListener(
          "registration",
          async (token) => {
            try {
              const { error } = await supabase.rpc("register_device_token", {
                p_token: token.value,
                p_platform: "android",
              })
              if (error) {
                setDiag({ status: "rpc-error", message: error.message })
                logger.error("Error registrando token FCM", { error: error.message })
              } else {
                setDiag({ status: "registered", message: `token len=${token.value.length}` })
              }
            } catch (err) {
              setDiag({ status: "rpc-error", message: String(err) })
              logger.error("Excepción registrando token FCM", { error: String(err) })
            }
          }
        )

        errorListener = await PushNotifications.addListener(
          "registrationError",
          (err) => {
            setDiag({ status: "registration-error", message: String(err?.error) })
            logger.error("Push registrationError", { error: String(err?.error) })
          }
        )

        await PushNotifications.register()
      } catch (err) {
        setDiag({ status: "registration-error", message: String(err) })
        logger.error("Error inicializando push notifications", { error: String(err) })
      }
    })()

    return () => {
      cancelled = true
      registrationListener?.remove?.()
      errorListener?.remove?.()
    }
  }, [enabled])

  return diag
}
