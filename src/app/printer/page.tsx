"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurant } from "@/hooks/useRestaurant"
import { advanceOrderStatusAction } from "@/app/actions/order-actions"
import { buildOrderTicket } from "@/lib/printer/escpos"
import {
  isWebBluetoothAvailable,
  requestPrinter,
  sendToPrinter,
  type BluetoothPrinter,
} from "@/lib/printer/bluetooth"
import { logger } from "@/lib/logger"

type FetchedOrder = {
  id: number
  status_id: number
  table_id: number
  tables: { table_number: number | null } | null
  order_items: { quantity: number; products: { product_name: string } | null }[]
}

type LogEntry = {
  id: string
  orderId: number
  kind: "ok" | "error"
  message: string
  at: Date
}

const NUEVO_STATUS_ID = 1

export default function PrinterPage() {
  const { restaurant, loading } = useRestaurant()
  const channelId = useId()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [printer, setPrinter] = useState<BluetoothPrinter | null>(null)
  const [pairing, setPairing] = useState(false)
  const [pairError, setPairError] = useState<string | null>(null)
  const restaurantRef = useRef(restaurant)
  const printerRef = useRef<BluetoothPrinter | null>(null)

  useEffect(() => {
    restaurantRef.current = restaurant
  }, [restaurant])

  useEffect(() => {
    printerRef.current = printer
  }, [printer])

  function appendEntry(partial: Omit<LogEntry, "id" | "at">) {
    setEntries((prev) => [
      { id: `${partial.orderId}-${performance.now()}`, at: new Date(), ...partial },
      ...prev.slice(0, 19),
    ])
  }

  async function handlePair() {
    if (pairing) return
    setPairing(true)
    setPairError(null)
    try {
      const result = await requestPrinter(restaurantRef.current?.printer_bluetooth_name ?? null)
      setPrinter(result)
      result.device.addEventListener("gattserverdisconnected", () => {
        setPrinter(null)
      })
    } catch (err) {
      logger.error("printer pair failed", { error: String(err) })
      setPairError(err instanceof Error ? err.message : "No se pudo emparejar la impresora")
    } finally {
      setPairing(false)
    }
  }

  const handleNewOrder = useCallback(async (orderId: number) => {
    const current = restaurantRef.current
    const currentPrinter = printerRef.current
    if (!current || current.order_handling_mode !== "printer") return

    if (!currentPrinter) {
      appendEntry({ orderId, kind: "error", message: "Impresora no conectada" })
      return
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status_id, table_id, tables ( table_number ), order_items ( quantity, products ( product_name ) )")
        .eq("id", orderId)
        .maybeSingle<FetchedOrder>()

      if (error || !data) {
        appendEntry({ orderId, kind: "error", message: "No se pudo leer el pedido" })
        return
      }

      if (data.status_id !== NUEVO_STATUS_ID) return

      const ticket = buildOrderTicket({
        restaurantName: current.restaurant_name ?? "Restaurante",
        tableNumber: data.tables?.table_number ?? data.table_id,
        orderId: data.id,
        items: data.order_items.map((item) => ({
          quantity: item.quantity,
          name: item.products?.product_name ?? "Producto",
        })),
      })

      await sendToPrinter(currentPrinter, ticket)

      const advance = await advanceOrderStatusAction(orderId)
      if (!advance.ok) {
        appendEntry({
          orderId,
          kind: "error",
          message: `Impreso pero falló avanzar estado: ${advance.error}`,
        })
        return
      }

      appendEntry({ orderId, kind: "ok", message: "Impreso y marcado en preparación" })
    } catch (err) {
      logger.error("printer page error", { error: String(err) })
      appendEntry({
        orderId,
        kind: "error",
        message: err instanceof Error ? err.message : "Error inesperado",
      })
    }
  }, [])

  useEffect(() => {
    if (!restaurant?.id) return

    const channel = supabase
      .channel(`printer-${restaurant.id}-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const id = (payload.new as { id?: number }).id
          if (typeof id === "number") handleNewOrder(id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurant?.id, channelId, handleNewOrder])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 text-sm font-semibold text-stone-600">
        Cargando...
      </main>
    )
  }

  if (!restaurant) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-center text-sm font-semibold text-stone-600">
        Sin restaurante. Iniciá sesión como admin.
      </main>
    )
  }

  const modeOk = restaurant.order_handling_mode === "printer"
  const btSupported = isWebBluetoothAvailable()
  const connected = Boolean(printer)
  const ready = modeOk && connected

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Impresora</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {restaurant.restaurant_name}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Mantené esta pantalla abierta en el dispositivo del local con la impresora ya emparejada por Bluetooth.
          </p>
        </header>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={`relative flex h-3 w-3 ${ready ? "" : "opacity-40"}`} aria-hidden="true">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
                  ready ? "bg-emerald-400" : "bg-stone-400"
                } opacity-75`}
              />
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${
                  ready ? "bg-emerald-500" : "bg-stone-400"
                }`}
              />
            </span>
            <p className="text-sm font-bold text-stone-900">
              {ready
                ? "Listo para imprimir"
                : !modeOk
                ? "Activá el modo Impresora en /admin/settings"
                : !btSupported
                ? "Tu navegador no soporta Web Bluetooth"
                : "Falta emparejar la impresora"}
            </p>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Modo</dt>
              <dd className="mt-1 font-semibold">
                {restaurant.order_handling_mode === "printer" ? "Impresora" : "Mesero"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Dispositivo</dt>
              <dd className="mt-1 font-semibold">
                {printer?.device.name ?? restaurant.printer_bluetooth_name ?? "—"}
              </dd>
            </div>
          </dl>

          {modeOk && btSupported && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePair}
                disabled={pairing}
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pairing ? "Emparejando..." : connected ? "Reemparejar" : "Emparejar impresora"}
              </button>
              {connected && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Conectado
                </span>
              )}
            </div>
          )}

          {pairError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {pairError}
            </p>
          )}

          {!modeOk && (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              El modo de pedidos está en &quot;Mesero&quot;. Cambialo en <span className="font-mono">/admin/settings</span>.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">Últimos pedidos</h2>
          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Esperando pedidos nuevos…</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-start justify-between rounded-2xl border px-4 py-3 text-sm ${
                    entry.kind === "ok"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div>
                    <p className={`font-bold ${entry.kind === "ok" ? "text-emerald-800" : "text-red-800"}`}>
                      Pedido #{entry.orderId}
                    </p>
                    <p className={`mt-0.5 text-xs ${entry.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>
                      {entry.message}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] font-mono text-stone-500">
                    {entry.at.toLocaleTimeString("es-CL")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
