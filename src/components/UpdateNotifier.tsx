"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { compareVersions } from "@/lib/app-version"

/**
 * Detección de actualizaciones para la app del MESERO (PWA y APK), en dos capas:
 *
 * 1. CONTENIDO (web): cada deploy sube CACHE_VERSION en sw.js; el SW nuevo hace
 *    skipWaiting + clients.claim → acá se escucha `controllerchange` y se
 *    ofrece recargar para tomar los assets nuevos al instante. Además se
 *    fuerza un chequeo del SW cada 30 min y al volver a la pestaña, porque las
 *    tablets de los meseros quedan abiertas todo el día.
 *
 * 2. BINARIO (solo APK Capacitor): compara la versión nativa instalada
 *    (App.getInfo().versionName) contra /api/app-version (manifiesto del
 *    deploy vigente). Si hay un APK más nuevo publicado en GitHub Releases,
 *    muestra un aviso persistente con el link de descarga (se puede posponer
 *    24 h). Los binarios cambian poco (solo plugins/config nativa): el
 *    contenido llega solo por la capa 1.
 *
 * El panel ADMIN no necesita esto: admin-sw.js no cachea navegaciones (siempre
 * red) y el .exe de escritorio se auto-actualiza con electron-updater.
 */

const NATIVE_SNOOZE_KEY = "mesa-native-update-snooze"
const NATIVE_SNOOZE_MS = 24 * 60 * 60 * 1000
const SW_CHECK_INTERVAL_MS = 30 * 60 * 1000

export function UpdateNotifier() {
  const pathname = usePathname()
  const [swUpdated, setSwUpdated] = useState(false)
  const [nativeUpdate, setNativeUpdate] = useState<{ version: string; url: string } | null>(null)

  const isWaiterArea = pathname.startsWith("/waiter") || pathname === "/screen"

  // ── Capa 1: actualización de contenido vía service worker ──
  useEffect(() => {
    if (!isWaiterArea) return
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    // Solo avisar si YA había un SW controlando (un controllerchange sin
    // controlador previo es la primera instalación, no una actualización).
    const hadController = Boolean(navigator.serviceWorker.controller)

    function onControllerChange() {
      if (hadController) setSwUpdated(true)
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    // Chequeo proactivo: el navegador revisa sw.js por su cuenta en cada
    // navegación, pero la app del mesero es una SPA que queda abierta por
    // horas → pedimos update() periódicamente y al volver a foco.
    let interval: ReturnType<typeof setInterval> | null = null
    function checkForUpdate() {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.update())
        .catch(() => undefined)
    }
    interval = setInterval(checkForUpdate, SW_CHECK_INTERVAL_MS)

    function onVisible() {
      if (document.visibilityState === "visible") checkForUpdate()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      if (interval) clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [isWaiterArea])

  // ── Capa 2: actualización del binario (solo dentro del APK Capacitor) ──
  useEffect(() => {
    if (!isWaiterArea) return

    let cancelled = false

    async function checkNative() {
      try {
        const { Capacitor } = await import("@capacitor/core")
        if (!Capacitor.isNativePlatform()) return

        // Pospuesto por el usuario hace menos de 24 h → no molestar.
        const snoozedAt = Number(localStorage.getItem(NATIVE_SNOOZE_KEY) || 0)
        if (Date.now() - snoozedAt < NATIVE_SNOOZE_MS) return

        const { App } = await import("@capacitor/app")
        const info = await App.getInfo()

        const res = await fetch("/api/app-version", { cache: "no-store" })
        if (!res.ok) return
        const manifest = (await res.json()) as {
          version?: string
          android?: { url?: string }
        }

        if (
          !cancelled &&
          manifest.version &&
          manifest.android?.url &&
          compareVersions(manifest.version, info.version) > 0
        ) {
          setNativeUpdate({ version: manifest.version, url: manifest.android.url })
        }
      } catch {
        // Sin red o fuera de Capacitor: silencio (la app sigue operativa).
      }
    }

    checkNative()
    return () => {
      cancelled = true
    }
  }, [isWaiterArea])

  async function openNativeDownload() {
    if (!nativeUpdate) return
    try {
      // En el WebView de Capacitor la descarga debe ir al navegador del sistema.
      const { Browser } = await import("@capacitor/browser")
      await Browser.open({ url: nativeUpdate.url })
    } catch {
      window.open(nativeUpdate.url, "_blank", "noopener")
    }
  }

  function snoozeNative() {
    try {
      localStorage.setItem(NATIVE_SNOOZE_KEY, String(Date.now()))
    } catch {
      // storage lleno/bloqueado: solo ocultar en esta sesión
    }
    setNativeUpdate(null)
  }

  if (!isWaiterArea) return null
  if (!swUpdated && !nativeUpdate) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-3 pointer-events-none">
      {nativeUpdate && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#3f3f46] bg-[#18181b] p-3 shadow-2xl">
          <span className="text-xl">⬆️</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-[#fafafa]">
              Nueva versión de la app ({nativeUpdate.version})
            </p>
            <p className="text-[11px] leading-4 text-[#a1a1aa]">
              Descargá e instalá el APK actualizado para seguir al día.
            </p>
          </div>
          <button
            type="button"
            onClick={snoozeNative}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#a1a1aa] transition hover:text-white"
          >
            Después
          </button>
          <button
            type="button"
            onClick={openNativeDownload}
            className="shrink-0 rounded-xl bg-[#fb923c] px-3 py-1.5 text-[12px] font-black text-[#1a1a1a] transition active:scale-[0.97]"
          >
            Descargar
          </button>
        </div>
      )}

      {swUpdated && (
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#3f3f46] bg-[#18181b] p-3 shadow-2xl">
          <span className="text-xl">✨</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-[#fafafa]">Actualización disponible</p>
            <p className="text-[11px] leading-4 text-[#a1a1aa]">
              Hay una versión nueva de la app. Recargá para aplicarla.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSwUpdated(false)}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#a1a1aa] transition hover:text-white"
          >
            Después
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-xl bg-[#fb923c] px-3 py-1.5 text-[12px] font-black text-[#1a1a1a] transition active:scale-[0.97]"
          >
            Recargar
          </button>
        </div>
      )}
    </div>
  )
}
