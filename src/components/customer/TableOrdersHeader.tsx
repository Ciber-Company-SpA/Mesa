"use client"

import { useTableOrders } from "@/hooks/useTableOrders"

type TableOrdersHeaderProps = {
  tableId: number | null
}

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

export function TableOrdersHeader({ tableId }: TableOrdersHeaderProps) {
  const { orders } = useTableOrders(tableId)

  if (orders.length === 0) return null

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/10 bg-stone-950/85 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-orange-200/80">
          {orders.length === 1 ? "1 pedido en curso" : `${orders.length} pedidos en curso`}
        </p>
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/10"
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
          </div>
        ))}
      </div>
    </div>
  )
}
