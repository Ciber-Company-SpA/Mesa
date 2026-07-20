"use client"

import { useMemo, useState } from "react"
import { Modal } from "@/components/ui/Modal"
import {
  savePromotion,
  promoDiscountPct,
  type Promotion,
  type SelectableProduct,
} from "@/services/promotions-service"

function formatPrice(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`
}

type DraftItem = {
  key: string
  product_id: number
  variant_id: number | null
  product_name: string
  variant_name: string | null
  unit_price: number
  quantity: number
}

function itemKey(productId: number, variantId: number | null) {
  return `${productId}:${variantId ?? "base"}`
}

export function PromotionDialog({
  open,
  onClose,
  products,
  initial,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  products: SelectableProduct[]
  initial: Promotion | null
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [promoPrice, setPromoPrice] = useState<string>(
    initial ? String(initial.promo_price) : ""
  )
  const [active, setActive] = useState(initial?.active ?? true)
  const [items, setItems] = useState<DraftItem[]>(
    (initial?.items ?? []).map((it) => ({
      key: itemKey(it.product_id, it.variant_id),
      product_id: it.product_id,
      variant_id: it.variant_id,
      product_name: it.product_name,
      variant_name: it.variant_name,
      unit_price: it.unit_price,
      quantity: it.quantity,
    }))
  )
  const [search, setSearch] = useState("")
  const [variantChoice, setVariantChoice] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const originalTotal = useMemo(
    () => items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0),
    [items]
  )
  const promoPriceNum = Number(promoPrice) || 0
  const discountPct = promoDiscountPct(originalTotal, promoPriceNum)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products.slice(0, 50)
    return products
      .filter((p) => p.product_name.toLowerCase().includes(q))
      .slice(0, 50)
  }, [products, search])

  function addItem(product: SelectableProduct, variantId: number | null) {
    const variant = variantId ? product.variants.find((v) => v.id === variantId) ?? null : null
    const unitPrice = variant ? variant.variant_price : product.product_price
    const key = itemKey(product.id, variantId)
    setItems((prev) => {
      const existing = prev.find((it) => it.key === key)
      if (existing) {
        return prev.map((it) =>
          it.key === key ? { ...it, quantity: Math.min(50, it.quantity + 1) } : it
        )
      }
      return [
        ...prev,
        {
          key,
          product_id: product.id,
          variant_id: variantId,
          product_name: product.product_name,
          variant_name: variant?.variant_name ?? null,
          unit_price: unitPrice,
          quantity: 1,
        },
      ]
    })
  }

  function setQty(key: string, qty: number) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, quantity: Math.max(1, Math.min(50, qty)) } : it))
    )
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  async function handleSave() {
    setError("")
    if (!name.trim()) return setError("Ponele un nombre a la promoción.")
    if (items.length === 0) return setError("Agregá al menos un producto.")
    if (promoPriceNum <= 0) return setError("Ingresá el precio de la promoción.")
    if (promoPriceNum > originalTotal) {
      return setError("El precio de promoción no puede superar el precio original.")
    }
    setSaving(true)
    try {
      await savePromotion({
        id: initial?.id ?? null,
        name: name.trim(),
        description: description.trim() || null,
        promo_price: promoPriceNum,
        image_url: initial?.image_url ?? null,
        active,
        items: items.map((it) => ({
          product_id: it.product_id,
          variant_id: it.variant_id,
          quantity: it.quantity,
        })),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la promoción.")
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
  const labelCls = "mb-1.5 block text-xs font-semibold text-stone-700"

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={initial ? "Editar promoción" : "Nueva promoción"}
      description="Combiná productos de tu carta y fijá un precio; el descuento se calcula solo."
      locked={saving}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Promo Once para 2"
              maxLength={120}
            />
          </div>
          <div>
            <label className={labelCls}>Descripción (opcional)</label>
            <input
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Café + torta + jugo"
              maxLength={200}
            />
          </div>
        </div>

        {/* Selector de productos */}
        <div>
          <label className={labelCls}>Agregar productos de tu carta</label>
          <input
            className={inputCls}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
          />
          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-stone-200 bg-white">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-stone-400">Sin resultados.</p>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 border-b border-stone-100 px-3 py-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800">{p.product_name}</p>
                    <p className="text-xs text-stone-500">
                      {p.variants.length > 0 ? "Con variantes" : formatPrice(p.product_price)}
                    </p>
                  </div>
                  {p.variants.length > 0 && (
                    <select
                      className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs"
                      value={variantChoice[p.id] ?? p.variants[0].id}
                      onChange={(e) =>
                        setVariantChoice((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                      }
                    >
                      {p.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.variant_name} · {formatPrice(v.variant_price)}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      addItem(
                        p,
                        p.variants.length > 0 ? variantChoice[p.id] ?? p.variants[0].id : null
                      )
                    }
                    className="shrink-0 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-orange-600"
                  >
                    + Agregar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Items elegidos */}
        {items.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="mb-2 text-xs font-semibold text-stone-700">Incluye</p>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.key} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-stone-800">
                      {it.product_name}
                      {it.variant_name ? <span className="text-stone-500"> · {it.variant_name}</span> : null}
                    </p>
                    <p className="text-xs text-stone-500">{formatPrice(it.unit_price)} c/u</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={it.quantity}
                    onChange={(e) => setQty(it.key, Number(e.target.value))}
                    className="w-16 rounded-lg border border-stone-200 bg-white px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    aria-label="Quitar"
                    className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Precio + descuento */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Precio de la promoción</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Precio original</span>
              <span className="font-semibold text-stone-700">{formatPrice(originalTotal)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-stone-500">Descuento</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  discountPct > 0 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10" : "text-stone-400"
                }`}
              >
                {discountPct}% OFF
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-stone-500">Se vende a</span>
              <span className="font-bold text-orange-600">{formatPrice(promoPriceNum)}</span>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-orange-500 focus:ring-orange-200"
          />
          Mostrar esta promoción en el menú
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {error}
          </p>
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
            {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear promoción"}
          </button>
        </div>
      </div>
    </Modal>
  )
}
