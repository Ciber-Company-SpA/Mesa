"use client"

import { useState } from "react"
import { useRestaurant } from "@/hooks/useRestaurant"
import { useCategories } from "@/hooks/useCategories"
import { useProducts } from "@/hooks/useProducts"
import { invalidateCache } from "@/hooks/useCache"
import { updateMenuTemplate } from "@/services/restaurant-service"
import { MENU_TEMPLATES, getTemplateDesign } from "@/lib/menu/templates"
import type { MenuTemplate } from "@/types/restaurant"
import type { Category } from "@/types/category"
import type { Product } from "@/types/product"

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

type PreviewBodyProps = {
  template: MenuTemplate
  restaurantName: string | undefined
  previewCategories: Category[]
  previewProducts: Product[]
}

function PreviewBody({ template, restaurantName, previewCategories, previewProducts }: PreviewBodyProps) {
  const design = getTemplateDesign(template)

  const overlayBg =
    template === "aurora" ? "bg-[#090d16]"
    : template === "cyber-ruby" ? "bg-[#090514]"
    : template === "eclipse" ? "bg-[#050507]"
    : "bg-stone-950"
  const overlayGradient =
    template === "aurora"
      ? "bg-[radial-gradient(circle_at_15%_20%,rgba(91,33,182,0.45)_0%,transparent_50%),radial-gradient(circle_at_85%_80%,rgba(6,182,212,0.3)_0%,transparent_50%)]"
      : template === "cyber-ruby"
      ? "bg-[radial-gradient(circle_at_85%_20%,rgba(217,70,239,0.18)_0%,transparent_50%),radial-gradient(circle_at_15%_80%,rgba(29,78,216,0.15)_0%,transparent_50%)]"
      : template === "eclipse"
      ? "bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.06)_0%,transparent_50%)]"
      : "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.22),_transparent_34%),radial-gradient(circle_at_85%_12%,_rgba(120,53,15,0.34),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_58%,_#020617_100%)]"

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl border border-stone-200 shadow-inner">
      <div className={`absolute inset-0 ${overlayBg}`} />
      <div className={`pointer-events-none absolute inset-0 ${overlayGradient}`} />

      <div className="relative h-full overflow-y-auto p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[10px] font-semibold ${design.mesaText}`}>Mesa 1</p>
            <h4 className={`mt-0.5 truncate text-base font-black tracking-tight ${design.titleClass}`}>
              {restaurantName ?? "Mi Restaurante"}
            </h4>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${design.abiertoBadge}`}>
            Abierto
          </span>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-hidden">
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${design.pillActive}`}>
            Todo
          </span>
          {previewCategories.slice(0, 2).map((cat) => (
            <span
              key={cat.id}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${design.pillInactive}`}
            >
              {cat.category_name}
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {previewProducts.length === 0 ? (
            <p className={`rounded-2xl px-3 py-4 text-center text-[10px] font-medium ${design.card} ${design.cardDesc}`}>
              Cargá productos y categorías para verlos acá.
            </p>
          ) : (
            previewProducts.map((item) => (
              <div
                key={item.id}
                className={`flex gap-2 rounded-2xl p-2 ${design.card}`}
              >
                <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl ${design.cardImageBg}`}>
                  {item.product_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product_image} alt={item.product_name} className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <span className={`text-xs ${design.cardCat}`}>+</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[9px] font-bold ${design.cardCat}`}>
                    {item.categories?.category_name}
                  </p>
                  <p className={`mt-0.5 line-clamp-1 text-xs font-black leading-tight ${design.cardName}`}>
                    {item.product_name}
                  </p>
                  <p className={`mt-1 text-[10px] font-black ${design.cardPrice}`}>
                    {formatPrice(item.product_price)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const { restaurant, loading, refresh } = useRestaurant()
  const { categories } = useCategories({ page: 1, pageSize: 4 })
  const { products } = useProducts({ page: 1, pageSize: 8 })

  const [selectedOverride, setSelectedOverride] = useState<MenuTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  const selected: MenuTemplate = selectedOverride ?? restaurant?.menu_template ?? "noche"

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateMenuTemplate({ template: selected })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
      refresh()
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  const currentTemplate = restaurant?.menu_template ?? "noche"
  const isDirty = selected !== currentTemplate

  const previewCategories = categories.slice(0, 3)
  const previewProducts = previewCategories
    .map((cat) => products.find((p) => p.category_id === cat.id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Ajustes</h2>
        <p className="mt-1 text-sm text-stone-500">
          Elegí el template del menú que ven tus clientes al escanear el QR.
        </p>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Template del menú</h3>
            <p className="mt-1 text-xs font-medium text-stone-500">
              Tocá un template para previsualizarlo a la derecha.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {MENU_TEMPLATES.map((template) => {
                const isSelected = selected === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedOverride(template.id)}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      isSelected
                        ? "border-orange-500 ring-2 ring-orange-200"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className="relative h-24 w-full" style={{ background: template.swatch }}>
                      {isSelected && (
                        <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-stone-900">{template.label}</p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">{template.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {feedback && (
              <p
                className={`mt-5 rounded-lg px-3 py-2 text-xs font-medium ${
                  feedback.kind === "ok"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback.message}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || !isDirty}
                className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              {!isDirty && !saving && (
                <span className="text-xs font-medium text-stone-400">Ya estás usando este template.</span>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Vista previa</p>
            <PreviewBody
              template={selected}
              restaurantName={restaurant?.restaurant_name}
              previewCategories={previewCategories}
              previewProducts={previewProducts}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
