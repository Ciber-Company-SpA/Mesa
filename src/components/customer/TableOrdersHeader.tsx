"use client"

import { useState } from "react"
import { useTableOrders, TableOrder } from "@/hooks/useTableOrders"

type TableOrdersHeaderProps = {
  tableId: number | null
}

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
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

  if (orders.length === 0) return null

  // Mantiene el modal actualizado con datos en tiempo real si el pedido seleccionado cambia
  const liveSelectedOrder = selectedOrder
    ? orders.find((o) => o.id === selectedOrder.id) ?? selectedOrder
    : null

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/10 bg-stone-950/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-orange-200/80">
            {orders.length === 1 ? "1 pedido en curso" : `${orders.length} pedidos en curso`}
          </p>
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {orders.map((order) => (
            <button
              type="button"
              onClick={() => setSelectedOrder(order)}
              key={order.id}
              className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2 ring-1 ring-white/10 transition hover:bg-white/15 active:scale-[0.98] text-left cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-stone-400">
                  Pedido #{order.id}
                </span>
                <span className="text-xs font-black text-orange-200">
                  {order.statusName ?? "Actualizando estado"}
                </span>
              </div>
              <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-[0.7rem] font-black text-orange-200 ring-1 ring-orange-200/20 tabular-nums">
                {formatPrice(order.total)}
              </span>
            </button>
          ))}
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
            </div>

            {/* Rastreador de Progreso */}
            {(() => {
              const currentStep = getOrderStatusStep(
                liveSelectedOrder.statusId,
                liveSelectedOrder.statusName
              )

              return (
                <div className="relative mt-6 px-4 pb-4">
                  <div className="absolute top-4 left-4 right-4 h-1 bg-white/10 rounded-full" />
                  <div
                    className="absolute top-4 left-4 h-1 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{
                      width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%",
                    }}
                  />

                  <div className="relative flex justify-between z-10">
                    {/* Paso 1: Recibido */}
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
                        Recibido
                      </span>
                    </div>

                    {/* Paso 2: En Cocina */}
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
                        En Cocina
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
                        <p className="text-xs font-black text-white truncate">{item.productName}</p>
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

              {getOrderStatusStep(liveSelectedOrder.statusId, liveSelectedOrder.statusName) === 3 ? (
                <div className="mt-4 rounded-2xl bg-emerald-500/10 p-3 text-center ring-1 ring-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-300">
                    🛎️ ¡Tu pedido está listo! El mesero lo llevará a tu mesa en unos instantes.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white/5 p-3 text-center ring-1 ring-white/10">
                  <p className="text-xs text-stone-300">
                    🍳 La cocina está elaborando tu pedido. ¡Te notificaremos aquí mismo cuando esté listo!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

