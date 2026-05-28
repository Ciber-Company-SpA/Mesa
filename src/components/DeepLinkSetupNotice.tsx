"use client"

import { useEffect, useState } from "react"

const DISMISS_KEY = "deep-link-setup-notice-dismissed"

/**
 * Aviso de configuración para que los QR abran la app directamente.
 *
 * Razón: en algunos fabricantes (notable: Xiaomi/HyperOS) la verificación de
 * App Link queda con el toggle de usuario en OFF por defecto, aunque el sistema
 * haya verificado correctamente el dominio. Sin que el usuario active "Abrir
 * enlaces compatibles", los QR siguen abriendo el navegador.
 *
 * Se renderiza solo dentro del WebView nativo (Capacitor). En web no aparece.
 * Se oculta tras "Lo entendí" con un flag persistente en localStorage.
 */
export function DeepLinkSetupNotice() {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { Capacitor } = await import("@capacitor/core")
        if (!Capacitor.isNativePlatform()) return
        const dismissed = localStorage.getItem(DISMISS_KEY) === "1"
        if (!dismissed && !cancelled) setShouldShow(true)
      } catch {
        // Capacitor no disponible (entorno web): no mostramos nada.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      // best-effort
    }
    setShouldShow(false)
  }

  async function handleOpenSettings() {
    // 1) Intentar la intent específica de Android 12+ que cae directo en el
    //    toggle de "Abrir por defecto". Esto evita que el usuario tenga que
    //    bucear por la jerarquía de ajustes en HyperOS / MIUI.
    try {
      const { AppLinksSettings } = await import("@/lib/plugins/app-links-settings")
      const result = await AppLinksSettings.openAppOpenByDefaultSettings()
      if (result.opened) return
    } catch {
      // Plugin nativo no disponible (entorno web o APK sin el plugin compilado).
    }

    // 2) Fallback genérico: abrir la pantalla "Info de la app" mediante el
    //    plugin de Capacitor. El usuario tiene que tocar "Abrir por defecto"
    //    manualmente desde ahí.
    try {
      const { NativeSettings, AndroidSettings } = await import("capacitor-native-settings")
      await NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails })
    } catch {
      // Sin plugins disponibles: no-op.
    }
  }

  if (!shouldShow) return null

  return (
    <div className="mb-6 rounded-2xl border border-orange-200/80 bg-orange-50/60 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
            <circle cx="6" cy="7" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold tracking-tight text-stone-900">
            Configurá los QR para que abran esta app
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            En algunos teléfonos (especialmente Xiaomi / HyperOS) hay que
            activar manualmente que los enlaces de mesa se abran acá en vez
            del navegador. Solo se hace una vez:
          </p>

          <ol className="mt-3 space-y-1 text-xs text-stone-700">
            <li>
              <strong>1.</strong> Ajustes → Aplicaciones → Administrar
              aplicaciones.
            </li>
            <li>
              <strong>2.</strong> Buscá <span className="font-semibold">Meseros-App</span> y entrá.
            </li>
            <li>
              <strong>3.</strong> Tocá <span className="font-semibold">Abrir de forma predeterminada</span> (o "Otros permisos" → "Abrir enlaces compatibles").
            </li>
            <li>
              <strong>4.</strong> Activá el toggle del dominio{" "}
              <code className="rounded bg-stone-200 px-1 py-0.5 text-[10px] font-semibold text-stone-700">
                mesa-production-f46d.up.railway.app
              </code>
              .
            </li>
          </ol>

          <p className="mt-3 text-[10px] text-stone-500">
            Si tu teléfono ya abre los QR en la app sin hacer nada, ignorá
            estos pasos.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleOpenSettings}
              className="rounded-full bg-orange-500 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow transition hover:bg-orange-600"
            >
              Abrir Ajustes
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Lo entendí, no mostrar más
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
