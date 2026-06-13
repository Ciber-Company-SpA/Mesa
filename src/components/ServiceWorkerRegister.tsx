"use client"

import { useEffect } from "react"
import { useRef } from "react"
import { usePathname, useRouter } from "next/navigation"

export function ServiceWorkerRegister() {
  const router = useRouter()
  const pathname = usePathname()
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // El Service Worker existe SOLO para la PWA del mesero (offline). El menú
    // del cliente (QR), admin y landing NO deben quedar bajo el SW: el cliente
    // en móvil no puede hacer un hard-reload, así que jamás debe quedar atrapado
    // con assets cacheados. En dev tampoco se registra.
    const isWaiterApp = process.env.NODE_ENV === "production" && pathname.startsWith("/waiter")

    if (!isWaiterApp) {
      // Fuera del área de mesero (o en dev): desregistrar cualquier SW viejo y
      // limpiar sus cachés, para servir siempre contenido fresco.
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
  }, [pathname])

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
