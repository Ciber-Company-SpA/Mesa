"use client"

import { useMemo } from "react"
import type { TableOrder } from "@/hooks/useTableOrders"

type GroupBillSummaryProps = {
  orders: TableOrder[]
}

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

type DinerGroup = {
  slot: number
  label: string
  subtotal: number
}

/**
 * Cuenta grupal: agrupa el total de los pedidos activos por comensal
 * (diner_slot) y muestra el total de la mesa. Solo aparece si hay pedidos
 * con comensal asignado.
 */
export function GroupBillSummary({ orders }: GroupBillSummaryProps) {
  const { groups, tableTotal } = useMemo(() => {
    const bySlot = new Map<number, DinerGroup>()
    let total = 0
    for (const order of orders) {
      total += order.total
      if (order.dinerSlot == null) continue
      const existing = bySlot.get(order.dinerSlot)
      if (existing) {
        existing.subtotal += order.total
      } else {
        bySlot.set(order.dinerSlot, {
          slot: order.dinerSlot,
          label: order.dinerLabel ?? `Comensal ${order.dinerSlot}`,
          subtotal: order.total,
        })
      }
    }
    return {
      groups: Array.from(bySlot.values()).sort((a, b) => a.slot - b.slot),
      tableTotal: total,
    }
  }, [orders])

  if (groups.length === 0) return null

  return (
    <section className="mt-3.5 rounded-2xl border border-[#232327] bg-[#131315] p-3">
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-[#fafafa]">
        Cuenta grupal
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {groups.map((g) => (
          <div
            key={g.slot}
            className="flex items-center gap-3 rounded-xl bg-[#1b1b1e] px-3.5 py-[10px]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fb923c]/15 text-[11px] font-extrabold text-[#fb923c]">
              {g.slot}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#d4d4d8]">
              {g.label}
            </span>
            <span className="shrink-0 text-[14px] font-extrabold text-[#fafafa]">
              {formatPrice(g.subtotal)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#232327] pt-3">
        <span className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]">
          Total mesa
        </span>
        <span className="text-[16px] font-extrabold text-[#fb923c]">
          {formatPrice(tableTotal)}
        </span>
      </div>
    </section>
  )
}
