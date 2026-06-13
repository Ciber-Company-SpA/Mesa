"use client"

import { useState } from "react"
import { useTableOrders } from "@/hooks/useTableOrders"

type TableOrdersHeaderProps = {
  qrCode: string | null
}

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

function formatClock(iso: string) {
  // La columna puede venir como timestamp UTC sin "Z"; lo forzamos para que
  // el navegador no lo interprete como hora local.
  const norm = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(norm)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
}

function isReady(statusId: number | null, statusName: string | null) {
  const name = (statusName ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (name.includes("listo")) return true
  return statusId === 3
}

/**
 * Panel "pedidos en curso" del comensal. Se suscribe por Realtime/polling a los
 * pedidos de la mesa (resueltos por el token del QR). Colapsable.
 */
export function TableOrdersHeader({ qrCode }: TableOrdersHeaderProps) {
  const { orders } = useTableOrders(qrCode)
  const [open, setOpen] = useState(true)

  if (orders.length === 0) return null

  return (
    <section className="mt-3.5 rounded-2xl border border-[#232327] bg-[#131315] p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fb923c] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#fb923c]" />
        </span>
        <span className="text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-[#fafafa]">
          {orders.length} pedido{orders.length !== 1 ? "s" : ""} en curso
        </span>
        <span className="flex-1" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          className="h-[17px] w-[17px] text-[#a1a1aa] transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 flex max-h-[168px] flex-col gap-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {orders.map((order) => {
            const done = isReady(order.statusId, order.statusName)
            const color = done ? "#4ade80" : "#fb923c"
            return (
              <div
                key={order.id}
                className="flex items-center gap-3 rounded-xl bg-[#1b1b1e] px-3.5 py-[11px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#71717a]">
                    Pedido #{order.id}
                    {order.createdAt ? ` · ${formatClock(order.createdAt)}` : ""}
                  </p>
                  <p className="mt-1 text-[15px] font-extrabold" style={{ color }}>
                    {order.statusName ?? "Actualizando"}
                  </p>
                </div>
                <span className="shrink-0 text-[14.5px] font-extrabold" style={{ color }}>
                  {formatPrice(order.total)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
