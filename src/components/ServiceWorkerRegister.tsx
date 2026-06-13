"use client"

import { useEffect } from "react"
import { useRef } from "react"
import { useRouter } from "next/navigation"

export function ServiceWorkerRegister() {
  const router = useRouter()
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV !== "production") {
      // En desarrollo NO registramos el SW. Además desregistramos cualquier SW
      // viejo (p. ej. de un `npm run start` previo en este mismo origen) y
      // limpiamos sus cachés: si no, sigue sirviendo chunks/HTML cacheados y un
      // F5 normal muestra código viejo (solo Ctrl+F5 lo evita).
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => undefined)

      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((k) => k.startsWith("mesa-offline-")).map((k) => caches.delete(k))
            )
          )
          .catch(() => undefined)
      }
      return
    }

    navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }, [])

  useEffect(() => {
    function handleOffline() {
      wasOfflineRef.current = true
    }

    function refreshAfterReconnect() {
      if (!wasOfflineRef.current || !navigator.onLine) return

      wasOfflineRef.current = false
      router.refresh()
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        refreshAfterReconnect()
      }
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", refreshAfterReconnect)
    window.addEventListener("focus", refreshAfterReconnect)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", refreshAfterReconnect)
      window.removeEventListener("focus", refreshAfterReconnect)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [router])

  return null
}
