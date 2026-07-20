"use client"

import { useInventoryAlerts } from "@/hooks/useInventoryAlerts"
import { formatStock } from "@/lib/inventory/units"
import type { InventoryAlertItem } from "@/types/ingredient"

type Props = {
  // Callback opcional para reponer un insumo desde la alerta (abre el diálogo
  // de stock en la página de inventario).
  onRestock?: (ingredientId: number) => void
}

function AlertRow({
  item,
  tone,
  onRestock,
}: {
  item: InventoryAlertItem
  tone: "red" | "amber"
  onRestock?: (ingredientId: number) => void
}) {
  const stockClass = tone === "red" ? "text-red-700" : "text-amber-700"
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-stone-900">{item.name}</p>
        <p className="mt-0.5 text-xs text-stone-500">
          Stock:{" "}
          <span className={`font-bold ${stockClass}`}>{formatStock(item.stock_actual, item.unit)}</span>
          <span className="text-stone-400">
            {" · "}mín {formatStock(item.stock_minimo, item.unit)}
          </span>
        </p>
      </div>
      {onRestock && (
        <button
          type="button"
          onClick={() => onRestock(item.id)}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
        >
          Reponer
        </button>
      )}
    </li>
  )
}

/**
 * Sección de alertas de inventario para /admin/inventory: dos grupos
 * diferenciados (Sin stock / Stock bajo). Se actualiza en vivo (realtime).
 */
export function InventoryAlertsPanel({ onRestock }: Props) {
  const { items, outCount, lowCount, totalCount, loading } = useInventoryAlerts()

  if (loading && totalCount === 0) {
    return (
      <div className="mt-5 h-16 animate-pulse rounded-2xl border border-stone-200 bg-white shadow-sm" />
    )
  }

  // Todo en orden: mensaje sobrio y positivo.
  if (totalCount === 0) {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          ✓
        </span>
        <p className="text-sm font-semibold text-emerald-800">
          Inventario al día — ningún insumo bajo su mínimo.
        </p>
      </div>
    )
  }

  const outItems = items.filter((i) => i.level === "sin_stock")
  const lowItems = items.filter((i) => i.level === "bajo")

  return (
    <section className="mt-5 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold tracking-tight text-stone-900">Alertas de stock</h3>
        <span className="text-xs font-medium text-stone-500">
          {totalCount} {totalCount === 1 ? "insumo necesita" : "insumos necesitan"} atención
        </span>
      </div>

      {outCount > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
              {outCount}
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Sin stock</p>
          </div>
          <ul className="space-y-1.5">
            {outItems.map((item) => (
              <AlertRow key={item.id} item={item} tone="red" onRestock={onRestock} />
            ))}
          </ul>
        </div>
      )}

      {lowCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold tabular-nums text-white">
              {lowCount}
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Stock bajo</p>
          </div>
          <ul className="space-y-1.5">
            {lowItems.map((item) => (
              <AlertRow key={item.id} item={item} tone="amber" onRestock={onRestock} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
