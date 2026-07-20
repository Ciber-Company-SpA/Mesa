"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { formatStock } from "@/lib/inventory/units"
import type { InventoryAlertItem } from "@/types/ingredient"

type Props = {
  outCount: number
  lowCount: number
  items: InventoryAlertItem[]
}

/**
 * Campana de alertas de inventario para el sidebar del admin. Presentacional:
 * recibe los datos del hook montado en el sidebar (una sola suscripción).
 * Muestra un punto rojo/ámbar cuando hay críticos y un popover con el detalle.
 */
export function InventoryAlertBell({ outCount, lowCount, items }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const total = outCount + lowCount

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const dotTone = outCount > 0 ? "bg-red-500" : "bg-amber-500"

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={total > 0 ? `${total} alertas de inventario` : "Alertas de inventario"}
        className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {total > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ${dotTone} ring-2 ring-white`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Alertas de stock</p>
            <Link
              href="/admin/inventory"
              onClick={() => setOpen(false)}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700"
            >
              Ver inventario
            </Link>
          </div>

          {total === 0 ? (
            <p className="py-4 text-center text-xs font-medium text-stone-500">
              Sin alertas. Inventario al día.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {items.map((item) => {
                const out = item.level === "sin_stock"
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-50"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-stone-800">{item.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        out ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {out ? "Sin stock" : formatStock(item.stock_actual, item.unit)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
