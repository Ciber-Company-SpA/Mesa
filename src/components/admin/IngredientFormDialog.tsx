"use client"

import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import {
  DISPLAY_UNIT_OPTIONS,
  toBaseAmount,
  baseUnitLabel,
  type DisplayUnit,
} from "@/lib/inventory/units"
import type { IngredientWithFlag } from "@/types/ingredient"
import type {
  CreateIngredientInput,
  UpdateIngredientInput,
} from "@/lib/validation/inventory"

type MutationResult = { ok: boolean; error?: string }

type Props = {
  open: boolean
  mode: "create" | "edit"
  ingredient?: IngredientWithFlag | null
  onClose: () => void
  onCreate: (input: CreateIngredientInput) => Promise<MutationResult>
  onUpdate: (input: UpdateIngredientInput) => Promise<MutationResult>
}

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
const labelClass = "mb-1.5 block text-xs font-semibold text-stone-700"

export function IngredientFormDialog({ open, mode, ingredient, onClose, onCreate, onUpdate }: Props) {
  const [name, setName] = useState("")
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>("unidad")
  const [stockInicial, setStockInicial] = useState("")
  const [stockMinimo, setStockMinimo] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Prefill al abrir.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizar el form con los props al abrir el modal
    setError("")
    if (mode === "edit" && ingredient) {
      setName(ingredient.name)
      setStockMinimo(String(ingredient.stock_minimo))
    } else {
      setName("")
      setDisplayUnit("unidad")
      setStockInicial("")
      setStockMinimo("")
    }
  }, [open, mode, ingredient])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError("")

    const trimmed = name.trim()
    if (!trimmed) {
      setError("El nombre del insumo es obligatorio")
      return
    }

    setSaving(true)
    try {
      let res: MutationResult
      if (mode === "edit" && ingredient) {
        const min = Number(stockMinimo) || 0
        if (min < 0) {
          setError("El stock mínimo no puede ser negativo")
          return
        }
        res = await onUpdate({
          id: ingredient.id,
          name: trimmed,
          unit: ingredient.unit, // la unidad base no se cambia tras crear
          stockMinimo: min,
        })
      } else {
        const inicial = Number(stockInicial) || 0
        const min = Number(stockMinimo) || 0
        if (inicial < 0 || min < 0) {
          setError("El stock no puede ser negativo")
          return
        }
        const { base, amount: inicialBase } = toBaseAmount(inicial, displayUnit)
        const { amount: minBase } = toBaseAmount(min, displayUnit)
        res = await onCreate({
          name: trimmed,
          unit: base,
          stockInicial: inicialBase,
          stockMinimo: minBase,
        })
      }

      if (res.ok) {
        onClose()
      } else {
        setError(res.error ?? "No se pudo guardar")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      size="md"
      title={mode === "edit" ? "Editar insumo" : "Nuevo insumo"}
      description={
        mode === "edit"
          ? "Modifica el nombre o el mínimo de alerta. El stock se ajusta con Reponer / Ajustar."
          : "Agrega un insumo al inventario. El stock se descuenta solo cuando vendes productos con receta."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Nombre del insumo</label>
          <input
            type="text"
            required
            disabled={saving}
            placeholder="Pan de hamburguesa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        {mode === "create" ? (
          <>
            <div>
              <label className={labelClass}>Unidad de medida</label>
              <select
                disabled={saving}
                value={displayUnit}
                onChange={(e) => setDisplayUnit(e.target.value as DisplayUnit)}
                className={inputClass}
              >
                {DISPLAY_UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-stone-500">
                No se puede cambiar después de crear el insumo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Stock inicial</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={saving}
                  placeholder="0"
                  value={stockInicial}
                  onChange={(e) => setStockInicial(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Mínimo de alerta</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={saving}
                  placeholder="0"
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className={labelClass}>
              Mínimo de alerta ({ingredient ? baseUnitLabel(ingredient.unit) : ""})
            </label>
            <input
              type="number"
              min="0"
              step="any"
              disabled={saving}
              placeholder="0"
              value={stockMinimo}
              onChange={(e) => setStockMinimo(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-stone-500">
              Te avisamos cuando el stock baje de este valor.
            </p>
          </div>
        )}

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
            {saving ? "Guardando..." : mode === "edit" ? "Guardar" : "Crear insumo"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
