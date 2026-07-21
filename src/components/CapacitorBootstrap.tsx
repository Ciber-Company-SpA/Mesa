"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { getSessionClaims } from "@/lib/supabase/claims"
import { logger } from "@/lib/logger"
import { checkQrBelongsToUserRestaurant } from "@/lib/qr-table-check"

/**
 * Maneja deep links de Android App Links cuando la app nativa (Capacitor) recibe
 * una URL `/r/<qrCode>`. Si hay sesión Supabase activa, navega el WebView a esa
 * URL (donde el route handler se encarga del resto). Si no hay sesión, abre el
 * link en el navegador del sistema vía Custom Tabs y deja la app fuera del flujo.
 * En web normal (no nativa) este componente es no-op.
 */
export function CapacitorBootstrap() {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false

    ;(async () => {
      try {
        const { Capacitor } = await import("@capacitor/core")
        if (!Capacitor.isNativePlatform()) return

        const [{ App }, { Browser }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/browser"),
        ])

        async function openExternal(url: string) {
          try {
            await Browser.open({ url })
          } catch (err) {
            logger.warn("No se pudo abrir el navegador externo", { error: String(err) })
            // Fallback duro: que el WebView lo intente.
            window.location.assign(url)
          }
        }

        async function handleUrl(url: string) {
          let parsed: URL
          try {
            parsed = new URL(url)
          } catch {
            return
          }

          // Solo nos interesan deep links del flujo de QR (/r/<code>).
          if (!parsed.pathname.startsWith("/r/")) return
          const qrCode = parsed.pathname.split("/").filter(Boolean)[1] ?? ""

          const claims = await getSessionClaims(supabase)

          // Sin sesión → al navegador del sistema (Custom Tab usa cookies de
          // Chrome y el server decide menú o /waiter/control).
          if (!claims) {
            await openExternal(url)
            return
          }

          // Con sesión pero la mesa no pertenece al restaurante del mesero
          // (ej. mesero de R1 que escanea QR de R2): mismo flujo de "sin sesión".
          // Así evitamos que el WebView muestre contenido cruzado y dejamos que
          // el navegador trate al usuario como cliente del otro restaurante.
          const check = await checkQrBelongsToUserRestaurant(qrCode, claims.userId)
          if (check.kind !== "ok") {
            await openExternal(url)
            return
          }

          // Misma sesión + mismo restaurante: dejamos al server route reclamar
          // la mesa y mandar a /waiter/control con tableId/tableNumber.
          window.location.assign(url)
        }

        // Cold start: si la app se abrió por un deep link, esta llamada devuelve
        // la URL inicial. En arranques normales devuelve `{ url: undefined }`.
        // OJO: `getLaunchUrl()` persiste el mismo valor durante todo el ciclo de
        // vida del proceso. Sin un flag en sessionStorage caemos en loop porque
        // cada recarga del WebView vuelve a procesar la URL inicial.
        const LAUNCH_FLAG = "capacitor-launch-url-handled"
        const alreadyHandled =
          typeof sessionStorage !== "undefined" && sessionStorage.getItem(LAUNCH_FLAG) === "1"

        if (!alreadyHandled) {
          const launch = await App.getLaunchUrl()
          if (!cancelled && launch?.url) {
            try {
              sessionStorage.setItem(LAUNCH_FLAG, "1")
            } catch {
              // sessionStorage bloqueado: igual seguimos, sólo arriesgamos un re-loop.
            }
            await handleUrl(launch.url)
          }
        }

        // Warm start: la app ya estaba abierta y recibe otro deep link.
        const listener = await App.addListener("appUrlOpen", (event) => {
          handleUrl(event.url).catch((err) => {
            logger.warn("Error procesando deep link", { error: String(err) })
          })
        })

        cleanup = () => {
          listener.remove().catch(() => undefined)
        }
      } catch {
        // Plugins de Capacitor no disponibles (entorno web). No hace falta hacer nada.
      }
    })()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return null
}
