"use client"

import { useEffect } from "react"
import { useCartStore } from "@/store/cartStore"
import { useTableCart } from "@/hooks/useTableCart"
import { useTableCartStore } from "@/store/tableCartStore"
import { CartItem } from "@/types/cart-item"
import { CartDrawerProps } from "@/types/cart-drawer"
import type { StoredOrder } from "@/types/cart-store"
import { useCreateOrder } from "@/hooks/useCreateOrder"
import { isStoredOrderInProgress, useLastOrder } from "@/hooks/useLastOrder"

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

function CartView({
  items,
  total,
  hasItems,
  isLoading,
  isWaitingConnection,
  error,
  onContinue,
}: {
  items: CartItem[]
  total: number
  hasItems: boolean
  isLoading: boolean
  isWaitingConnection: boolean
  error: string | null
  onContinue: () => void
}) {
  const updateQuantity = useTableCartStore((state) => state.updateQuantity)
  const removeItem = useTableCartStore((state) => state.removeItem)
  return (
    <>
      <div className="max-h-[48vh] overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {items.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/5 px-5 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/20 text-2xl font-black text-orange-100 ring-1 ring-orange-200/20">
              +
            </div>
            <h3 className="mt-4 text-lg font-black">Aun no hay productos</h3>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Cuando agregues algo del menu, aparecera aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex gap-3 rounded-[1.5rem] bg-white/10 p-3 ring-1 ring-white/10"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-stone-900">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-xs font-bold text-stone-400">Sin imagen</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-black leading-tight">{item.name}</h3>

                  {/* ✅ reemplaza el <p> de cantidad por esto */}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        item.quantity === 1
                          ? removeItem(item.id)
                          : updateQuantity(item.id, item.quantity - 1)
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-black text-orange-100 ring-1 ring-white/10 transition hover:bg-white/20"
                    >
                      −
                    </button>

                    <span className="min-w-[1.25rem] text-center text-sm font-black">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/20 text-sm font-black text-orange-200 ring-1 ring-orange-200/20 transition hover:bg-orange-500/30"
                    >
                      +
                    </button>
                  </div>

                  <p className="mt-1 text-sm font-black text-orange-200">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-white/10 px-5 py-5">
        {error && (
          <p className="mb-3 text-center text-xs font-semibold text-red-400">{error}</p>
        )}

        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold text-stone-300">Total</span>
          <span className="text-2xl font-black text-orange-200">{formatPrice(total)}</span>
        </div>

        <button
          type="button"
          disabled={!hasItems || isLoading}
          onClick={onContinue}
          className={`flex w-full items-center justify-center rounded-[1.35rem] px-5 py-4 text-sm font-black ring-1 transition ${
            hasItems && !isLoading
              ? "bg-orange-500 text-stone-950 shadow-2xl shadow-orange-500/25 ring-orange-200/50 hover:bg-orange-400"
              : "cursor-not-allowed bg-stone-800 text-stone-500 ring-white/10"
          }`}
        >
          {isWaitingConnection
            ? "Esperando conexion..."
            : isLoading
              ? "Creando pedido..."
              : "Continuar pedido"}
        </button>
      </footer>
    </>
  )
}


export function CartDrawer({ isOpen, onClose, tableId, restaurantId }: CartDrawerProps) {
  const { items, total } = useTableCart(tableId, restaurantId)
  const hasItems = items.length > 0

  const {
    isLoading,
    isWaitingConnection,
    error,
    createOrder,
    resetOrderDraft,
  } = useCreateOrder({
    items,
    tableId,
    restaurantId,
  })

  const { activeOrder, isChecking, syncOrder } = useLastOrder()

  useEffect(() => {
    if (!isOpen || !activeOrder) return
    const timeoutId = window.setTimeout(() => syncOrder(activeOrder), 0)
    return () => window.clearTimeout(timeoutId)
  }, [isOpen, activeOrder, syncOrder])

  async function refreshActiveOrder(order: StoredOrder) {
    await syncOrder(order)

    if (!isStoredOrderInProgress(useCartStore.getState().lastOrder)) {
      resetOrderDraft()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4 backdrop-blur-md"
      onClick={onClose}
    >
      <section
        className="flex max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-stone-950/95 text-white shadow-2xl shadow-black/40 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-orange-200/80">Pedido actual</p>
            <h2 className="text-2xl font-black tracking-tight">Tu carrito</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-black text-orange-100 ring-1 ring-white/10 transition hover:bg-white/15"
            aria-label="Cerrar carrito"
          >
            x
          </button>
        </header>

        {activeOrder ? (
          <div className="border-b border-white/10 bg-orange-500/10 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-orange-200/80">
                  Pedido en curso
                </p>
                <p className="mt-1 truncate text-xs font-bold text-stone-200">
                  {activeOrder.statusName ?? "Actualizando estado"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refreshActiveOrder(activeOrder)}
                disabled={isChecking}
                className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[0.7rem] font-black text-orange-100 ring-1 ring-white/10 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:text-stone-500"
              >
                {isChecking ? "..." : "Actualizar"}
              </button>
            </div>
          </div>
        ) : null}

        <CartView
          items={items}
          total={total}
          hasItems={hasItems}
          isLoading={isLoading}
          isWaitingConnection={isWaitingConnection}
          error={error}
          onContinue={createOrder}
        />
      </section>
    </div>
  )
}
