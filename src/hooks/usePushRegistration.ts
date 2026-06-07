"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

/**
 * Registra el token FCM del dispositivo en `device_tokens` para que el backend
 * pueda enviarle push notifications cuando llegue un pedido nuevo.
 *
 * - Solo corre en plataforma nativa (Capacitor). En web es no-op.
 * - Pide permiso al usuario la primera vez.
 * - Cuando FCM entrega el token, lo upsertea vía RPC `register_device_token`.
 * - Si FCM rota el token, también lo actualiza.
 */
export function usePushRegistration(enabled: boolean) {
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
      } catch {
        return
      }
      if (!isNative || cancelled) return

      let PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications
      try {
        const mod = await import("@capacitor/push-notifications")
        PushNotifications = mod.PushNotifications
      } catch (err) {
        logger.warn("Push plugin no disponible", { error: String(err) })
        return
      }

      try {
        let perm = await PushNotifications.checkPermissions()
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions()
        }
        if (perm.receive !== "granted") return

        registrationListener = await PushNotifications.addListener(
          "registration",
          async (token) => {
            try {
              const { error } = await supabase.rpc("register_device_token", {
                p_token: token.value,
                p_platform: "android",
              })
              if (error) {
                logger.error("Error registrando token FCM", { error: error.message })
              }
            } catch (err) {
              logger.error("Excepción registrando token FCM", { error: String(err) })
            }
          }
        )

        errorListener = await PushNotifications.addListener(
          "registrationError",
          (err) => {
            logger.error("Push registrationError", { error: String(err?.error) })
          }
        )

        await PushNotifications.register()
      } catch (err) {
        logger.error("Error inicializando push notifications", { error: String(err) })
      }
    })()

    return () => {
      cancelled = true
      registrationListener?.remove?.()
      errorListener?.remove?.()
    }
  }, [enabled])
}
