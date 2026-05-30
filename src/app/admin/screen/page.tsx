"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurant } from "@/hooks/useRestaurant"
import { logger } from "@/lib/logger"

type FetchedOrder = {
  id: number
  status_id: number
  table_id: number
  created_at: string
  tables: { table_number: number | null } | null
  order_items: { product_quantity: number; product_name: string | null }[]
}

type DisplayOrder = {
  id: number
  tableNumber: number | string
  receivedAt: Date
  items: { quantity: number; name: string }[]
}

const EN_PREPARACION_STATUS_ID = 2

function formatClock(date: Date) {
  return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
}

export default function ScreenPage() {
  const { restaurant, loading } = useRestaurant()
  const channelId = useId()
  const [orders, setOrders] = useState<DisplayOrder[]>([])
  const seenIds = useRef<Set<number>>(new Set())
  const restaurantRef = useRef(restaurant)

  useEffect(() => {
    restaurantRef.current = restaurant
  }, [restaurant])

  const handleOrderEvent = useCallback(async (orderId: number) => {
    const current = restaurantRef.current
    if (current?.output_mode !== "screen") return
    if (seenIds.current.has(orderId)) return

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status_id, table_id, created_at, tables ( table_number ), order_items ( product_quantity, product_name )")
        .eq("id", orderId)
        .maybeSingle<FetchedOrder>()

      if (error || !data) return
      if (data.status_id !== EN_PREPARACION_STATUS_ID) return

      seenIds.current.add(orderId)

      const display: DisplayOrder = {
        id: data.id,
        tableNumber: data.tables?.table_number ?? data.table_id,
        receivedAt: new Date(),
        items: data.order_items.map((item) => ({
          quantity: item.product_quantity,
          name: item.product_name ?? "Producto",
        })),
      }

      setOrders((prev) => [display, ...prev].slice(0, 12))
    } catch (err) {
      logger.error("screen page error", { error: String(err) })
    }
  }, [])

  useEffect(() => {
    if (!restaurant?.id) return

    const channel = supabase
      .channel(`screen-${restaurant.id}-${channelId}`)
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
      <main className="flex min-h-screen items-center justify-center bg-stone-950 text-lg font-semibold text-stone-400">
        Cargando...
      </main>
    )
  }

  if (!restaurant) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-center text-lg font-semibold text-stone-400">
        Sin restaurante. Iniciá sesión como admin.
      </main>
    )
  }

  const screenEnabled = restaurant.output_mode === "screen"

  return (
    <main className="min-h-screen bg-stone-950 px-8 py-8 text-white">
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-orange-400">Cocina</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{restaurant.restaurant_name}</h1>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Pedidos en preparación</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">{orders.length}</p>
        </div>
      </header>

      {!screenEnabled && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200">
          La salida actual no es Pantalla. Cambiala en <span className="font-mono">/admin/settings</span> para que los
          pedidos aparezcan acá.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center text-center text-stone-500">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 text-3xl">⏳</div>
          <p className="mt-4 text-lg font-semibold">Esperando pedidos...</p>
          <p className="mt-1 text-sm text-stone-600">Los pedidos aparecen apenas entran en preparación.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-300">
                    Mesa {order.tableNumber}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">#{order.id}</p>
                </div>
                <span className="rounded-full bg-orange-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-200 ring-1 ring-orange-500/40">
                  {formatClock(order.receivedAt)}
                </span>
              </div>

              <ul className="mt-4 space-y-2">
                {order.items.map((item, idx) => (
                  <li
                    key={`${order.id}-${idx}`}
                    className="flex items-center gap-3 rounded-xl bg-black/30 px-3 py-2"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-sm font-extrabold text-orange-200 tabular-nums">
                      {item.quantity}
                    </span>
                    <span className="truncate text-sm font-semibold text-white">{item.name}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
