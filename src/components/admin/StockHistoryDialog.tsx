"use client"

import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { listMovementsAction } from "@/app/actions/inventory-actions"
import { formatStock } from "@/lib/inventory/units"
import type { IngredientWithFlag } from "@/types/ingredient"
import type { StockMovementWithIngredient, StockMotivo } from "@/types/stock-movement"

type Props = {
  open: boolean
  ingredient: IngredientWithFlag | null
  onClose: () => void
}

const MOTIVO_LABEL: Record<StockMotivo, string> = {
  inicial: "Stock inicial",
  venta: "Venta",
  reposicion: "Reposición",
  ajuste: "Ajuste",
  conteo: "Conteo físico",
  merma: "Merma",
}

const MOTIVO_CLASS: Record<StockMotivo, string> = {
  inicial: "bg-stone-100 text-stone-600",
  venta: "bg-red-50 text-red-700",
  reposicion: "bg-emerald-50 text-emerald-700",
  ajuste: "bg-amber-50 text-amber-700",
  conteo: "bg-sky-50 text-sky-700",
  merma: "bg-amber-50 text-amber-700",
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function StockHistoryDialog({ open, ingredient, onClose }: Props) {
  const [movements, setMovements] = useState<StockMovementWithIngredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !ingredient) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError("")
      const res = await listMovementsAction(ingredient.id)
      if (cancelled) return
      if (res.ok) setMovements(res.data)
      else setError(res.error)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, ingredient])

  if (!ingredient) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Historial de movimientos"
      description={ingredient.name}
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-stone-500">Cargando movimientos...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : movements.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">Sin movimientos todavía.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {movements.map((m) => {
            const positive = m.delta >= 0
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${MOTIVO_CLASS[m.motivo]}`}
                    >
                      {MOTIVO_LABEL[m.motivo]}
                    </span>
                    <span className="text-[11px] text-stone-500">{formatDate(m.created_at)}</span>
                  </div>
                  {m.nota && <p className="mt-0.5 truncate text-xs text-stone-600">{m.nota}</p>}
                </div>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    positive ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {positive ? "+" : "−"}
                  {formatStock(Math.abs(m.delta), ingredient.unit)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
