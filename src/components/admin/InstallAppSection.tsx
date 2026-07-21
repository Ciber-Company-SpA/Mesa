"use client"

import { useEffect, useMemo, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { APP_DOWNLOADS } from "@/lib/app-version"

// Evento beforeinstallprompt (no está tipado en lib.dom).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function useIsStandalone() {
  const [standalone, setStandalone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)")
    const update = () =>
      setStandalone(
        mq.matches ||
          // iOS Safari expone navigator.standalone
          (window.navigator as unknown as { standalone?: boolean }).standalone === true
      )
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return standalone
}

/** Instala la PWA del panel admin en este equipo. */
function InstallAdminCard() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const standalone = useIsStandalone()

  // Detectar iOS (Safari no dispara beforeinstallprompt).
  const isIos = useMemo(() => {
    if (typeof navigator === "undefined") return false
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
  }, [])

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const alreadyInstalled = installed || standalone

  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-2xl">
          💻
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold tracking-tight text-stone-900">
            App para administrar tu restaurante
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Instalá este panel como una app en tu computador o tablet. Se abre en
            su propia ventana, sin la barra del navegador.
          </p>

          {alreadyInstalled ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
              ✓ La app ya está instalada en este equipo
            </div>
          ) : prompt ? (
            <button
              type="button"
              onClick={async () => {
                await prompt.prompt()
                const choice = await prompt.userChoice
                if (choice.outcome === "accepted") setInstalled(true)
                setPrompt(null)
              }}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              📥 Instalar app en este equipo
            </button>
          ) : isIos ? (
            <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-xs font-medium text-stone-600 ring-1 ring-stone-200">
              En iPhone/iPad: tocá el botón <strong>Compartir</strong> de Safari y
              luego <strong>&ldquo;Agregar a inicio&rdquo;</strong>.
            </p>
          ) : (
            <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-xs font-medium text-stone-600 ring-1 ring-stone-200">
              Si no ves el botón, abrí este panel en <strong>Chrome</strong> o{" "}
              <strong>Edge</strong> y usá el ícono de instalar de la barra de
              direcciones (o menú ⋮ → <strong>Instalar</strong>).
            </p>
          )}

          <div className="mt-4 flex items-start gap-2 text-xs text-stone-500">
            <span className="mt-0.5 text-emerald-600">✓</span>
            <p>
              <strong className="text-stone-700">Siempre actualizada:</strong> la
              app carga tu panel en vivo, así que se sincroniza sola con cada
              mejora que publicamos. No hay que reinstalar nada.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Comparte la app del mesero (se instala en el teléfono de cada mesero). */
function WaiterAppCard() {
  const [origin, setOrigin] = useState("https://tumesaqr.com")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lee window.location.origin tras montar (evita hydration mismatch)
      setOrigin(window.location.origin)
    }
  }, [])

  const waiterUrl = `${origin}/waiter/login`

  async function copy() {
    try {
      await navigator.clipboard.writeText(waiterUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard no disponible: ignorar
    }
  }

  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-2xl">
          📱
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold tracking-tight text-stone-900">
            App para tus meseros
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Compartí este acceso con tu equipo. Cada mesero lo abre en su
            teléfono e instala la app operativa para atender las mesas.
          </p>

          <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
              <QRCodeSVG
                value={waiterUrl}
                size={132}
                level="M"
                marginSize={0}
                fgColor="#1c1917"
                bgColor="#ffffff"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Enlace para el mesero
              </p>
              <p className="mt-1 break-all text-sm font-medium text-stone-800">
                {waiterUrl}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  {copied ? "✓ Copiado" : "Copiar enlace"}
                </button>
                <a
                  href={waiterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  Abrir
                </a>
              </div>
              <p className="mt-3 text-xs text-stone-500">
                En el teléfono del mesero, tocá <strong>&ldquo;Instalar app&rdquo;</strong>{" "}
                en la pantalla de acceso.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Instaladores nativos (Windows y Android) publicados como GitHub Releases. */
function DownloadsCard() {
  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
          📦
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-stone-900">
              Instaladores para descargar
            </h3>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600 ring-1 ring-stone-200">
              v{APP_DOWNLOADS.version}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Si preferís programas instalables en vez de la app del navegador,
            descargá la versión para tu equipo.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Windows */}
            <div className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪟</span>
                <p className="text-sm font-bold text-stone-800">Windows · Panel de administración</p>
              </div>
              <p className="mt-1 flex-1 text-xs text-stone-500">
                Programa de escritorio del panel. Se actualiza solo: descarga las
                versiones nuevas en segundo plano y te avisa para reiniciar.
              </p>
              <a
                href={APP_DOWNLOADS.windows.url}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
              >
                ⬇ Descargar instalador (.exe)
              </a>
              <p className="mt-2 text-[11px] leading-4 text-stone-400">
                Si Windows muestra un aviso de seguridad, elegí{" "}
                <strong>Más información → Ejecutar de todas formas</strong>{" "}
                (instalador sin firma comercial).
              </p>
            </div>

            {/* Android */}
            <div className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <p className="text-sm font-bold text-stone-800">Android · App del mesero</p>
              </div>
              <p className="mt-1 flex-1 text-xs text-stone-500">
                App nativa con escáner QR con cámara. El contenido se actualiza
                solo con cada mejora; si publicamos una app nueva, avisa adentro
                con el link de descarga.
              </p>
              <a
                href={APP_DOWNLOADS.android.url}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
              >
                ⬇ Descargar app (.apk)
              </a>
              <p className="mt-2 text-[11px] leading-4 text-stone-400">
                En el teléfono: abrir el archivo y permitir{" "}
                <strong>instalar apps de origen desconocido</strong> si lo pide
                (se instala fuera de Play Store).
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-stone-500">
            <span className="mt-0.5 text-emerald-600">✓</span>
            <p>
              <strong className="text-stone-700">Siempre al día:</strong> ambas
              apps cargan el sistema en vivo, así que cada mejora que publicamos
              les llega sola. Además detectan cuando hay una versión nueva del
              programa y te avisan para actualizarlo.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InstallAppSection() {
  return (
    <div className="space-y-6">
      <InstallAdminCard />
      <WaiterAppCard />
      <DownloadsCard />
    </div>
  )
}
