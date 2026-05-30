"use client"

import { useEffect, useState } from "react"
import { useTableOrders, TableOrder } from "@/hooks/useTableOrders"

type TableOrdersHeaderProps = {
  tableId: number | null
}

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

function getElapsedSeconds(order: TableOrder, nowMs: number) {
  const start = new Date(order.createdAt).getTime()
  const end = order.readyAt ? new Date(order.readyAt).getTime() : nowMs
  return Math.max(0, Math.floor((end - start) / 1000))
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}min`
}

function getOrderStatusStep(statusId: number | null, statusName: string | null): number {
  const name = (statusName ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (name.includes("listo")) return 3
  if (name.includes("preparando") || name.includes("preparacion") || name.includes("cocina")) return 2
  if (statusId === 3) return 3
  if (statusId === 2) return 2
  return 1
}

export function TableOrdersHeader({ tableId }: TableOrdersHeaderProps) {
  const { orders } = useTableOrders(tableId)
  const [selectedOrder, setSelectedOrder] = useState<TableOrder | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const hasLiveCounter = orders.some((o) => !o.readyAt)

  useEffect(() => {
    if (!hasLiveCounter) return
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [hasLiveCounter])

  if (orders.length === 0) return null

  // Mantiene el modal actualizado con datos en tiempo real si el pedido seleccionado cambia
  const liveSelectedOrder = selectedOrder
    ? orders.find((o) => o.id === selectedOrder.id) ?? selectedOrder
    : null

  return (
    <>
      <div className="sticky top-3 z-30 mb-6 rounded-3xl border border-white/10 bg-stone-950/80 p-4 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-xl transition-all duration-300">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 pl-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-orange-200/90">
              {orders.length === 1 ? "1 pedido en curso" : `${orders.length} pedidos en curso`}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {orders.map((order) => {
            const step = getOrderStatusStep(order.statusId, order.statusName)
            const badgeStyles =
              step === 3
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                : step === 2
                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                : "bg-orange-500/10 text-orange-300 border-orange-500/20"

            return (
              <button
                type="button"
                onClick={() => setSelectedOrder(order)}
                key={order.id}
                className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 ring-1 ring-white/5 transition duration-300 hover:bg-white/10 hover:border-white/20 active:scale-[0.97] text-left cursor-pointer shadow-lg shadow-black/10"
              >
                <div className="flex flex-col">
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-stone-400">
                    Pedido #{order.id} · {formatElapsed(getElapsedSeconds(order, nowMs))}
                  </span>
                  <span className="text-xs font-black text-white mt-0.5">
                    {order.statusName ?? "Actualizando"}
                  </span>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-black tabular-nums ${badgeStyles}`}>
                  {formatPrice(order.total)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal Premium de Detalles del Pedido */}
      {liveSelectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[2.25rem] bg-stone-950/95 p-6 text-white shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-stone-300 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
              aria-label="Cerrar detalles"
            >
              ✕
            </button>

            {/* Header del Modal */}
            <div className="pr-10">
              <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-orange-200/80">
                Detalles del Servicio
              </span>
              <h3 className="mt-1 text-xl font-black tracking-tight">
                Pedido #{liveSelectedOrder.id}
              </h3>
              <p className="mt-1 text-[0.7rem] font-bold text-stone-400">
                {liveSelectedOrder.readyAt ? "Tiempo de preparacion: " : "En curso: "}
                <span className="font-black text-orange-200">
                  {formatElapsed(getElapsedSeconds(liveSelectedOrder, nowMs))}
                </span>
              </p>
            </div>

            {/* Rastreador de Progreso */}
            {(() => {
              const currentStep = getOrderStatusStep(
                liveSelectedOrder.statusId,
                liveSelectedOrder.statusName
              )

              return (
                <div className="relative mt-6 px-4 pb-4">
                  {/* Riel del track (va exactamente de centro a centro de los círculos extremos) */}
                  <div className="absolute top-4 left-[34px] right-[34px] h-1 bg-white/10 rounded-full overflow-hidden">
                    {/* Barra coloreada de progreso activo */}
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                      style={{
                        width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
                      }}
                    />
                  </div>

                  <div className="relative flex justify-between z-10">
                    {/* Paso 1: Nuevo */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ${
                          currentStep >= 1
                            ? "bg-stone-950 border-orange-500 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.3)] ring-2 ring-orange-500/20"
                            : "bg-stone-900 border-white/10 text-stone-500"
                        }`}
                      >
                        📝
                      </div>
                      <span
                        className={`mt-2 text-[10px] font-bold ${
                          currentStep >= 1 ? "text-orange-200" : "text-stone-500"
                        }`}
                      >
                        Nuevo
                      </span>
                    </div>

                    {/* Paso 2: En Preparación */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ${
                          currentStep >= 2
                            ? "bg-stone-950 border-orange-500 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.3)] ring-2 ring-orange-500/20 animate-pulse"
                            : "bg-stone-900 border-white/10 text-stone-500"
                        }`}
                      >
                        🍳
                      </div>
                      <span
                        className={`mt-2 text-[10px] font-bold ${
                          currentStep >= 2 ? "text-orange-200" : "text-stone-500"
                        }`}
                      >
                        En Preparación
                      </span>
                    </div>

                    {/* Paso 3: Listo */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ${
                          currentStep >= 3
                            ? "bg-stone-950 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/20"
                            : "bg-stone-900 border-white/10 text-stone-500"
                        }`}
                      >
                        🛎️
                      </div>
                      <span
                        className={`mt-2 text-[10px] font-bold ${
                          currentStep >= 3 ? "text-emerald-400 font-extrabold" : "text-stone-500"
                        }`}
                      >
                        Listo
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Listado de Productos */}
            <div className="mt-4 border-t border-white/10 pt-5">
              <h4 className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-stone-400 mb-3">
                Productos en este pedido
              </h4>
              <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                {liveSelectedOrder.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/5"
                  >
                    <div className="flex gap-2.5 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-orange-500/10 text-[10px] font-black text-orange-200 ring-1 ring-orange-200/20">
                        {item.productQuantity}x
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</p>
                        {item.notes && (
                          <p className="mt-0.5 text-[10px] text-stone-400 leading-normal italic">
                            Nota: &ldquo;{item.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-orange-100/90 shrink-0">
                      {formatPrice(item.productPrice * item.productQuantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen Total y Mensaje */}
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  Monto Total
                </span>
                <span className="text-lg font-black text-orange-200">
                  {formatPrice(liveSelectedOrder.total)}
                </span>
              </div>

              {(() => {
                const step = getOrderStatusStep(
                  liveSelectedOrder.statusId,
                  liveSelectedOrder.statusName
                )
                if (step === 3) {
                  return (
                    <div className="mt-4 rounded-2xl bg-emerald-500/10 p-3 text-center ring-1 ring-emerald-500/20">
                      <p className="text-xs font-bold text-emerald-300">
                        🛎️ ¡Tu pedido está listo! El mesero lo llevará a tu mesa en unos instantes.
                      </p>
                    </div>
                  )
                }
                if (step === 2) {
                  return (
                    <div className="mt-4 rounded-2xl bg-white/5 p-3 text-center ring-1 ring-white/10">
                      <p className="text-xs text-stone-300">
                        🍳 Tu pedido está en preparación en la cocina. ¡Te notificaremos cuando esté listo!
                      </p>
                    </div>
                  )
                }
                return (
                  <div className="mt-4 rounded-2xl bg-white/5 p-3 text-center ring-1 ring-white/10">
                    <p className="text-xs text-stone-300">
                      📝 Tu pedido ha sido recibido y está en la fila de espera. ¡Te notificaremos cuando comience su preparación!
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

