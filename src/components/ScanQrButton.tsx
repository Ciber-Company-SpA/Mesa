"use client"

import { useEffect, useState } from "react"
import { logger } from "@/lib/logger"

type Props = {
  /** Callback opcional para errores de UX (ej. mostrar toast). */
  onError?: (message: string) => void
}

/**
 * Botón que abre el scanner QR nativo (Google Code Scanner vía
 * @capacitor-mlkit/barcode-scanning). Solo se renderiza dentro del WebView
 * de Capacitor; en web normal no aparece.
 *
 * Al escanear, parsea el QR: acepta tanto la URL completa
 * `https://<host>/r/<code>` como solo el código suelto, y navega el WebView
 * a `/r/<code>` para reusar la lógica server-side de reclamo de mesa.
 */
export function ScanQrButton({ onError }: Props) {
  const [available, setAvailable] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { Capacitor } = await import("@capacitor/core")
        if (!cancelled) setAvailable(Capacitor.isNativePlatform())
      } catch {
        // sin Capacitor: web
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleScan() {
    if (scanning) return
    setScanning(true)
    try {
      const { BarcodeScanner, BarcodeFormat } = await import(
        "@capacitor-mlkit/barcode-scanning"
      )

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      })

      if (!barcodes.length) return
      const raw = (barcodes[0].rawValue ?? "").trim()
      if (!raw) return

      const qrCode = extractQrCode(raw)
      if (!qrCode) {
        onError?.("El QR escaneado no es una mesa válida.")
        return
      }

      // Navega al route handler /r/<code> que reclama la mesa según sesión.
      window.location.assign(`/r/${encodeURIComponent(qrCode)}`)
    } catch (err) {
      // El plugin lanza si el usuario cancela; lo silenciamos.
      const msg = err instanceof Error ? err.message : String(err)
      if (/cancel/i.test(msg)) return
      logger.warn("Error escaneando QR", { error: msg })
      onError?.("No se pudo abrir el scanner. Asegurate de tener permisos de cámara.")
    } finally {
      setScanning(false)
    }
  }

  if (!available) return null

  return (
    <button
      type="button"
      onClick={handleScan}
      disabled={scanning}
      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="15" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="15" width="6" height="6" rx="1" />
        <path strokeLinecap="round" d="M15 15h1v1m-1 4h6v-6m-3 3h0" />
      </svg>
      {scanning ? "Abriendo…" : "Escanear QR"}
    </button>
  )
}

function extractQrCode(raw: string): string | null {
  // Acepta el código directo o la URL completa.
  try {
    const url = new URL(raw)
    const match = url.pathname.match(/^\/r\/([^/?#]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
  } catch {
    // No es URL: tratamos como código directo.
  }
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(raw)) return raw
  return null
}
