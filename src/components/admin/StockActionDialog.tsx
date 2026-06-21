"use client"

import { useEffect, useMemo, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import {
  DISPLAY_UNIT_OPTIONS,
  toBaseAmount,
  formatStock,
  type DisplayUnit,
} from "@/lib/inventory/units"
import type { IngredientWithFlag, IngredientUnit } from "@/types/ingredient"
import type {
  RestockIngredientInput,
  SetIngredientStockInput,
} from "@/lib/validation/inventory"

type MutationResult = { ok: boolean; error?: string }

type Props = {
  open: boolean
  mode: "restock" | "adjust"
  ingredient: IngredientWithFlag | null
  onClose: () => void
  onRestock: (input: RestockIngredientInput) => Promise<MutationResult>
  onSetStock: (input: SetIngredientStockInput) => Promise<MutationResult>
}

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
const labelClass = "mb-1.5 block text-xs font-semibold text-stone-700"

// Unidades de entrada permitidas según la unidad base del insumo.
function displayUnitsFor(base: IngredientUnit): DisplayUnit[] {
  if (base === "g") return ["g", "kg"]
  if (base === "ml") return ["ml", "l"]
  return ["unidad"]
}

export function StockActionDialog({ open, mode, ingredient, onClose, onRestock, onSetStock }: Props) {
  const [amount, setAmount] = useState("")
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("unidad")
  const [motivo, setMotivo] = useState<"ajuste" | "conteo" | "merma">("ajuste")
  const [nota, setNota] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const allowedUnits = useMemo(
    () => (ingredient ? displayUnitsFor(ingredient.unit) : ["unidad"] as DisplayUnit[]),
    [ingredient]
  )

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizar el form al abrir el modal
    setError("")
    setAmount("")
    setNota("")
    setMotivo("ajuste")
    setDisplayUnit(allowedUnits[0])
  }, [open, allowedUnits])

  if (!ingredient) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving || !ingredient) return
    setError("")

    const value = Number(amount)
    if (!Number.isFinite(value) || value < 0) {
      setError("Ingresa un valor válido")
      return
    }
    if (mode === "restock" && value <= 0) {
      setError("La cantidad a reponer debe ser mayor a 0")
      return
    }

    const { amount: baseAmount } = toBaseAmount(value, displayUnit)

    setSaving(true)
    try {
      const res =
        mode === "restock"
          ? await onRestock({ id: ingredient.id, cantidad: baseAmount, nota: nota.trim() || null })
          : await onSetStock({
              id: ingredient.id,
              nuevoStock: baseAmount,
              motivo,
              nota: nota.trim() || null,
            })

      if (res.ok) onClose()
      else setError(res.error ?? "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const isRestock = mode === "restock"

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      size="md"
      title={isRestock ? "Reponer stock" : "Ajustar stock"}
      description={ingredient.name}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
          Stock actual:{" "}
          <span className="font-bold text-stone-900">
            {formatStock(ingredient.stock_actual, ingredient.unit)}
          </span>
        </div>

        <div>
          <label className={labelClass}>
            {isRestock ? "Cantidad a reponer" : "Nuevo stock (conteo físico)"}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              required
              autoFocus
              disabled={saving}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
            {allowedUnits.length > 1 && (
              <select
                disabled={saving}
                value={displayUnit}
                onChange={(e) => setDisplayUnit(e.target.value as DisplayUnit)}
                className="w-28 shrink-0 rounded-xl border border-stone-200 bg-stone-50 px-2 py-2.5 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
              >
                {allowedUnits.map((u) => (
                  <option key={u} value={u}>
                    {DISPLAY_UNIT_OPTIONS.find((o) => o.value === u)?.label ?? u}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {!isRestock && (
          <div>
            <label className={labelClass}>Motivo</label>
            <select
              disabled={saving}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as "ajuste" | "conteo" | "merma")}
              className={inputClass}
            >
              <option value="ajuste">Ajuste manual</option>
              <option value="conteo">Conteo físico</option>
              <option value="merma">Merma (pérdida)</option>
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>Nota (opcional)</label>
          <input
            type="text"
            disabled={saving}
            placeholder={isRestock ? "Compra proveedor, factura #..." : "Motivo del ajuste"}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : isRestock ? "Reponer" : "Guardar ajuste"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
