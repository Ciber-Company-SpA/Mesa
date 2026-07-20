"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { saveDiscount, type DiscountCode, type DiscountScope, type DiscountType } from "@/services/discounts-service"
import type { Category } from "@/types/category"
import type { SelectableProduct } from "@/services/promotions-service"

const DAYS = [
  { i: 1, label: "Lun" },
  { i: 2, label: "Mar" },
  { i: 3, label: "Mié" },
  { i: 4, label: "Jue" },
  { i: 5, label: "Vie" },
  { i: 6, label: "Sáb" },
  { i: 0, label: "Dom" },
]

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
const labelCls = "mb-1.5 block text-xs font-semibold text-stone-700"

export function DiscountDialog({
  open,
  onClose,
  categories,
  products,
  initial,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  products: SelectableProduct[]
  initial: DiscountCode | null
  onSaved: () => void
}) {
  const [code, setCode] = useState(initial?.code ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [type, setType] = useState<DiscountType>(initial?.discount_type ?? "percent")
  const [value, setValue] = useState<string>(initial ? String(initial.discount_value) : "")
  const [scope, setScope] = useState<DiscountScope>(initial?.scope ?? "all")
  const [categoryId, setCategoryId] = useState<string>(initial?.scope_category_id ? String(initial.scope_category_id) : "")
  const [productId, setProductId] = useState<string>(initial?.scope_product_id ? String(initial.scope_product_id) : "")
  const [days, setDays] = useState<number[]>(initial?.days_of_week ?? [])
  const [timeFrom, setTimeFrom] = useState(initial?.time_from ?? "")
  const [timeTo, setTimeTo] = useState(initial?.time_to ?? "")
  const [validFrom, setValidFrom] = useState(initial?.valid_from ?? "")
  const [validTo, setValidTo] = useState(initial?.valid_to ?? "")
  const [minOrder, setMinOrder] = useState<string>(initial?.min_order_amount ? String(initial.min_order_amount) : "")
  const [usageLimit, setUsageLimit] = useState<string>(initial?.usage_limit ? String(initial.usage_limit) : "")
  const [active, setActive] = useState(initial?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function toggleDay(i: number) {
    setDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]))
  }

  async function handleSave() {
    setError("")
    const valueNum = Number(value) || 0
    if (!code.trim()) return setError("El código es obligatorio.")
    if (valueNum <= 0) return setError("Ingresá el valor del descuento.")
    if (type === "percent" && valueNum > 100) return setError("El porcentaje no puede superar 100.")
    if (scope === "category" && !categoryId) return setError("Elegí una categoría.")
    if (scope === "product" && !productId) return setError("Elegí un producto.")
    if (timeFrom && !timeTo) return setError("Completá la hora de fin.")
    if (timeTo && !timeFrom) return setError("Completá la hora de inicio.")

    setSaving(true)
    try {
      await saveDiscount({
        id: initial?.id ?? null,
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        discount_type: type,
        discount_value: valueNum,
        scope,
        scope_category_id: scope === "category" ? Number(categoryId) : null,
        scope_product_id: scope === "product" ? Number(productId) : null,
        // Vacío o los 7 días => aplica todos los días (null).
        days_of_week: days.length === 0 || days.length === 7 ? null : days.slice().sort(),
        time_from: timeFrom || null,
        time_to: timeTo || null,
        valid_from: validFrom || null,
        valid_to: validTo || null,
        min_order_amount: minOrder ? Number(minOrder) : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        active,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cupón.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={initial ? "Editar cupón" : "Nuevo cupón"}
      description="Definí las reglas; el comensal verá el cupón solo cuando corresponda."
      locked={saving}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Código</label>
            <input
              className={`${inputCls} uppercase`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej. CAFE10"
              maxLength={40}
            />
          </div>
          <div>
            <label className={labelCls}>Descripción (opcional)</label>
            <input
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. 10% en cafés los miércoles"
              maxLength={200}
            />
          </div>
        </div>

        {/* Tipo + valor */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Tipo de descuento</label>
            <div className="flex gap-2">
              {(["percent", "amount"] as DiscountType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    type === t
                      ? "border-orange-300 bg-orange-50 text-orange-700"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {t === "percent" ? "Porcentaje %" : "Monto fijo $"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>{type === "percent" ? "Porcentaje (%)" : "Monto ($)"}</label>
            <input
              type="number"
              min={0}
              max={type === "percent" ? 100 : undefined}
              className={inputCls}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? "10" : "1000"}
            />
          </div>
        </div>

        {/* Alcance */}
        <div>
          <label className={labelCls}>Se aplica a</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "all", l: "Toda la carta" },
                { v: "category", l: "Una categoría" },
                { v: "product", l: "Un producto" },
              ] as { v: DiscountScope; l: string }[]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setScope(o.v)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  scope === o.v
                    ? "border-orange-300 bg-orange-50 text-orange-700"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {scope === "category" && (
            <select className={`${inputCls} mt-2`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Elegí una categoría…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category_name}
                </option>
              ))}
            </select>
          )}
          {scope === "product" && (
            <select className={`${inputCls} mt-2`} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Elegí un producto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Días de la semana */}
        <div>
          <label className={labelCls}>Días (vacío = todos los días)</label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d.i}
                type="button"
                onClick={() => toggleDay(d.i)}
                className={`h-9 w-11 rounded-lg border text-xs font-bold transition ${
                  days.includes(d.i)
                    ? "border-orange-300 bg-orange-500 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horario + vigencia */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Franja horaria (opcional)</label>
            <div className="flex items-center gap-2">
              <input type="time" className={inputCls} value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
              <span className="text-stone-400">a</span>
              <input type="time" className={inputCls} value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Vigencia (opcional)</label>
            <div className="flex items-center gap-2">
              <input type="date" className={inputCls} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              <span className="text-stone-400">a</span>
              <input type="date" className={inputCls} value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Mínimo + límite */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Mínimo de compra ($, opcional)</label>
            <input type="number" min={0} className={inputCls} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="Sin mínimo" />
          </div>
          <div>
            <label className={labelCls}>Límite de usos (opcional)</label>
            <input type="number" min={1} className={inputCls} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Sin límite" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-orange-500 focus:ring-orange-200"
          />
          Cupón activo
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-500/35 disabled:opacity-50"
          >
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear cupón"}
          </button>
        </div>
      </div>
    </Modal>
  )
}
