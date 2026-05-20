"use client"

import { useEffect } from "react"
import { useRef } from "react"
import { useRouter } from "next/navigation"

export function ServiceWorkerRegister() {
  const router = useRouter()
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

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
