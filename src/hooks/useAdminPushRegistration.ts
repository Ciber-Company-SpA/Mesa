"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

/**
 * Registro de Web Push (FCM) para el PANEL ADMIN. CREDENTIAL-READY:
 *
 *  - Sin la config de Firebase en el entorno (NEXT_PUBLIC_FIREBASE_*), es un
 *    NO-OP total: no pide permiso, no carga nada, no toca la red ni el CSP.
 *  - Al definir la config + la VAPID key (ver docs/push-admin.md) y ampliar el
 *    CSP a los hosts de Google FCM, se activa solo: pide permiso, carga el SDK
 *    compat desde la CDN (sin dependencia npm, igual que el service worker),
 *    obtiene el token y lo registra en device_tokens como platform 'web'. A
 *    partir de ahí, send-stock-alert-push (ya desplegada) empieza a notificar.
 *
 * El token web funciona con las Edge Functions FCM v1 existentes (message.token).
 */
const CFG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
const SDK_VERSION = "10.12.0"

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const s = document.createElement("script")
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(s)
  })
}

export function useAdminPushRegistration(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    // Credential-ready: sin config de Firebase → no-op total.
    if (!CFG.apiKey || !CFG.projectId || !VAPID_KEY) return
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        if (Notification.permission === "denied") return
        const perm =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission()
        if (perm !== "granted" || cancelled) return

        await loadScript(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app-compat.js`)
        await loadScript(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging-compat.js`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firebase = (window as any).firebase
        if (!firebase || cancelled) return

        if (!firebase.apps?.length) firebase.initializeApp(CFG)
        const messaging = firebase.messaging()

        // SW de FCM en su scope propio de FCM (una URL virtual, no navegable),
        // para NO colisionar con el SW offline del mesero (scope "/") ni con el
        // SW de instalación del admin (admin-sw.js, scope "/admin"). El push en
        // segundo plano no necesita que el SW controle las páginas de /admin.
        const params = new URLSearchParams({
          apiKey: CFG.apiKey!,
          authDomain: CFG.authDomain ?? "",
          projectId: CFG.projectId!,
          messagingSenderId: CFG.messagingSenderId ?? "",
          appId: CFG.appId ?? "",
        })
        const swReg = await navigator.serviceWorker.register(
          `/firebase-messaging-sw.js?${params.toString()}`,
          { scope: "/firebase-cloud-messaging-push-scope" }
        )

        const token: string = await messaging.getToken({
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        })
        if (!token || cancelled) return

        const { error } = await supabase.rpc("register_device_token", {
          p_token: token,
          p_platform: "web",
        })
        if (error) {
          logger.error("Error registrando token web push (admin)", { error: error.message })
        }
      } catch (err) {
        logger.warn("Web push admin no disponible", { error: String(err) })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])
}
