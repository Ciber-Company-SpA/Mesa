"use client"

import { useState } from "react"
import { useRestaurant } from "@/hooks/useRestaurant"
import { updateStockMenuMode } from "@/services/restaurant-service"
import type { StockMenuMode } from "@/types/restaurant"

/**
 * Selector del modo de control de disponibilidad por stock (nivel global del
 * restaurante). Bloquear = el stock oculta/bloquea productos; Solo informativo =
 * el stock nunca oculta ni bloquea, solo alimenta las alertas de inventario.
 */
export function StockModeSelector() {
  const { restaurant, loading, refresh } = useRestaurant()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const mode: StockMenuMode = restaurant?.stock_menu_mode ?? "block"

  async function setMode(next: StockMenuMode) {
    if (saving || loading || next === mode) return
    setSaving(true)
    setError("")
    const res = await updateStockMenuMode({ mode: next })
    if (!res.ok) setError(res.error)
    else await refresh()
    setSaving(false)
  }

  const options: { value: StockMenuMode; label: string }[] = [
    { value: "block", label: "Bloquear" },
    { value: "info", label: "Solo informativo" },
  ]

  return (
    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-stone-900">Disponibilidad según stock</p>
          <p className="mt-0.5 max-w-prose text-xs text-stone-500">
            {mode === "block"
              ? "Si falta un insumo crítico de la receta, el producto se muestra agotado y no se puede pedir."
              : "El stock nunca oculta ni bloquea productos; solo genera las alertas internas de inventario."}
          </p>
        </div>

        <div className="inline-flex shrink-0 rounded-xl border border-stone-200 bg-stone-50 p-0.5" role="group">
          {options.map((opt) => {
            const active = mode === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={saving || loading}
                onClick={() => setMode(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                  active
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
