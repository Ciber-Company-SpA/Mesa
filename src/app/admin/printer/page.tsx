"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurant } from "@/hooks/useRestaurant"
import { buildOrderTicket, formatTicketAsText } from "@/lib/printer/escpos"
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

const EN_PREPARACION_STATUS_ID = 2

export default function PrinterPage() {
  const { restaurant, loading } = useRestaurant()
  const channelId = useId()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [printer, setPrinter] = useState<BluetoothPrinter | null>(null)
  const [pairing, setPairing] = useState(false)
  const [pairError, setPairError] = useState<string | null>(null)
  const restaurantRef = useRef(restaurant)
  const printerRef = useRef<BluetoothPrinter | null>(null)
  const printedOrderIds = useRef<Set<number>>(new Set())

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

  const [testing, setTesting] = useState(false)
  const [previewText, setPreviewText] = useState<string | null>(null)

  function buildSampleTicket() {
    const current = restaurantRef.current
    return {
      restaurantName: current?.restaurant_name ?? "Restaurante",
      tableNumber: 1,
      orderId: 9999,
      items: [
        { quantity: 1, name: "Café con leche" },
        { quantity: 2, name: "Empanada de carne" },
        { quantity: 1, name: "Coca-Cola 500ml" },
      ],
    }
  }

  function handlePreview() {
    setPreviewText(formatTicketAsText(buildSampleTicket()))
  }

  async function handleTestPrint() {
    if (testing) return
    const current = restaurantRef.current
    const currentPrinter = printerRef.current
    if (!current || !currentPrinter) return

    setTesting(true)
    try {
      const ticket = buildOrderTicket(buildSampleTicket())
      await sendToPrinter(currentPrinter, ticket)
      appendEntry({ orderId: 9999, kind: "ok", message: "Ticket de prueba impreso" })
    } catch (err) {
      logger.error("test print failed", { error: String(err) })
      appendEntry({
        orderId: 9999,
        kind: "error",
        message: err instanceof Error ? err.message : "Error en impresión de prueba",
      })
    } finally {
      setTesting(false)
    }
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

  const handleOrderEvent = useCallback(async (orderId: number) => {
    const current = restaurantRef.current
    if (!current?.printer_enabled) return
    if (printedOrderIds.current.has(orderId)) return

    const currentPrinter = printerRef.current
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

      if (data.status_id !== EN_PREPARACION_STATUS_ID) return

      printedOrderIds.current.add(orderId)

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
      appendEntry({ orderId, kind: "ok", message: "Ticket impreso" })
    } catch (err) {
      printedOrderIds.current.delete(orderId)
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
          if (typeof id === "number") handleOrderEvent(id)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const id = (payload.new as { id?: number }).id
          if (typeof id === "number") handleOrderEvent(id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurant?.id, channelId, handleOrderEvent])

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

  const printerEnabled = restaurant.printer_enabled
  const btSupported = isWebBluetoothAvailable()
  const connected = Boolean(printer)
  const ready = printerEnabled && connected

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
                : !printerEnabled
                ? "Activá la impresión en /admin/settings"
                : !btSupported
                ? "Tu navegador no soporta Web Bluetooth"
                : "Falta emparejar la impresora"}
            </p>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Destino</dt>
              <dd className="mt-1 font-semibold">
                {restaurant.order_destination === "kitchen" ? "Cocina directa" : "Mesero"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Dispositivo</dt>
              <dd className="mt-1 font-semibold">
                {printer?.device.name ?? restaurant.printer_bluetooth_name ?? "—"}
              </dd>
            </div>
          </dl>

          {printerEnabled && btSupported && (
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
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={testing}
                  className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-800 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testing ? "Imprimiendo..." : "Probar impresión"}
                </button>
              )}
              <button
                type="button"
                onClick={handlePreview}
                className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-800 shadow-sm transition hover:bg-stone-50"
              >
                Vista previa del ticket
              </button>
              {connected && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Conectado
                </span>
              )}
            </div>
          )}

          {previewText && (
            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Vista previa</p>
                <button
                  type="button"
                  onClick={() => setPreviewText(null)}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                >
                  Cerrar
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-5 text-stone-800">
{previewText}
              </pre>
            </div>
          )}

          {pairError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {pairError}
            </p>
          )}

          {!printerEnabled && (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              La impresión está desactivada. Activala en <span className="font-mono">/admin/settings</span>.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">Últimos tickets</h2>
          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Esperando pedidos en preparación…</p>
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
