"use client"

import { useState } from "react"
import { CartDrawer } from "@/components/customer/CartDrawer"
import { useTableCart } from "@/hooks/useTableCart"
import { getCartTargetId } from "@/lib/customer/fly-to-cart"

type FloatingCartButtonProps = {
  tableId: number
  restaurantId: number
}

export function FloatingCartButton({ tableId, restaurantId }: FloatingCartButtonProps) {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const { items, total } = useTableCart(tableId, restaurantId)

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0)

  if (itemCount === 0) return null

  return (
    <>
      <button
        id={getCartTargetId()}
        className="fixed bottom-4 left-1/2 z-30 flex h-[58px] w-[calc(100%-28px)] max-w-[340px] -translate-x-1/2 items-center gap-3 rounded-full bg-[#ff5b16] px-2.5 text-[#15110d] shadow-[0_14px_32px_rgba(255,91,22,0.4)] transition hover:bg-[#ff6d2d]"
        type="button"
        aria-label="Abrir carrito"
        onClick={() => setIsCartOpen(true)}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-base font-extrabold">
          {itemCount}
        </span>
        <span className="flex-1 text-left text-base font-extrabold">Ver carrito</span>
        <span className="mr-1 text-base font-extrabold">${total.toLocaleString("es-CL")}</span>
        <span className="mr-2 text-xl" aria-hidden="true">&gt;</span>
      </button>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        tableId={tableId}
        restaurantId={restaurantId}
      />
    </>
  )
}
