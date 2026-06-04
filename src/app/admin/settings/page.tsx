"use client"

import { useState } from "react"
import { useRestaurant } from "@/hooks/useRestaurant"
import { useCategories } from "@/hooks/useCategories"
import { useProducts } from "@/hooks/useProducts"
import { invalidateCache } from "@/hooks/useCache"
import {
  updateDeliveryConfig,
  updateMenuTemplate,
  updateOrderDestination,
  updateOutputMode,
  updateRestaurantCity,
  updateRestaurantName,
} from "@/services/restaurant-service"
import { MENU_TEMPLATES, getTemplateDesign } from "@/lib/menu/templates"
import type { MenuTemplate, OrderDestination, OutputMode, Restaurant } from "@/types/restaurant"
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
    : template === "forest-moss" ? "bg-[#0b1411]"
    : template === "nordic-minimal" ? "bg-[#eef3f7]"
    : "bg-stone-950"
  const overlayGradient =
    template === "aurora"
      ? "bg-[radial-gradient(circle_at_15%_20%,rgba(91,33,182,0.45)_0%,transparent_50%),radial-gradient(circle_at_85%_80%,rgba(6,182,212,0.3)_0%,transparent_50%)]"
      : template === "cyber-ruby"
      ? "bg-[radial-gradient(circle_at_85%_20%,rgba(217,70,239,0.18)_0%,transparent_50%),radial-gradient(circle_at_15%_80%,rgba(29,78,216,0.15)_0%,transparent_50%)]"
      : template === "eclipse"
      ? "bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.06)_0%,transparent_50%)]"
      : template === "forest-moss"
      ? "bg-[radial-gradient(circle_at_85%_20%,rgba(245,158,11,0.22)_0%,transparent_45%),radial-gradient(circle_at_20%_80%,rgba(22,163,74,0.32)_0%,transparent_60%),radial-gradient(circle_at_50%_50%,rgba(163,230,53,0.06)_0%,transparent_60%)]"
      : template === "nordic-minimal"
      ? "bg-[linear-gradient(120deg,rgba(235,243,250,1)_0%,rgba(225,235,245,0.6)_40%,rgba(240,244,248,1)_100%),linear-gradient(45deg,transparent_70%,rgba(215,228,240,0.4)_70%)]"
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

type RestaurantNameSectionProps = {
  currentName: string | undefined
  onSaved: () => void
}

function RestaurantNameSection({ currentName, onSaved }: RestaurantNameSectionProps) {
  const [override, setOverride] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  const name = override ?? currentName ?? ""
  const isDirty = override !== null && override.trim() !== (currentName ?? "").trim()

  async function handleSave() {
    if (saving || !isDirty) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateRestaurantName({ name: name.trim() })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      onSaved()
      setOverride(null)
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-stone-900">Nombre del restaurante</h3>
      <p className="mt-1 text-xs font-medium text-stone-500">
        Es el nombre que aparece en el menú público y en el panel.
      </p>

      <div className="mt-5 max-w-md">
        <input
          type="text"
          value={name}
          onChange={(e) => setOverride(e.target.value)}
          maxLength={60}
          placeholder="Mi Restaurante"
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
        />
      </div>

      {feedback && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${
            feedback.kind === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {!isDirty && !saving && (
          <span className="text-xs font-medium text-stone-400">Sin cambios.</span>
        )}
      </div>
    </section>
  )
}

type RestaurantCitySectionProps = {
  currentCity: string | null | undefined
  onSaved: () => void
}

function RestaurantCitySection({ currentCity, onSaved }: RestaurantCitySectionProps) {
  const [override, setOverride] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  const city = override ?? currentCity ?? ""
  const isDirty = override !== null && override.trim() !== (currentCity ?? "").trim()

  async function handleSave() {
    if (saving || !isDirty) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateRestaurantCity({ city: city.trim() || null })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      onSaved()
      setOverride(null)
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-stone-900">Ciudad / Región</h3>
      <p className="mt-1 text-xs font-medium text-stone-500">
        Aparece en el directorio público de restaurantes en la página principal.
      </p>

      <div className="mt-5 max-w-md">
        <input
          type="text"
          value={city}
          onChange={(e) => setOverride(e.target.value)}
          maxLength={80}
          placeholder="Ej. Santiago, Providencia"
          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
        />
      </div>

      {feedback && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${
            feedback.kind === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {!isDirty && !saving && (
          <span className="text-xs font-medium text-stone-400">Sin cambios.</span>
        )}
      </div>
    </section>
  )
}

type DeliverySectionProps = {
  restaurant: Restaurant | null
  onSaved: () => void
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function DeliverySection({ restaurant, onSaved }: DeliverySectionProps) {
  const initialEnabled = restaurant?.delivery_enabled ?? false
  const initialSlug = restaurant?.delivery_slug ?? ""

  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null)
  const [slugOverride, setSlugOverride] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "")
  const publicUrl = initialSlug ? `${baseUrl}/restaurants/${initialSlug}` : ""

  async function handleCopy() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setFeedback({ kind: "error", message: "No se pudo copiar al portapapeles" })
    }
  }

  const enabled = enabledOverride ?? initialEnabled
  const slug = slugOverride ?? initialSlug
  const isDirty =
    enabled !== initialEnabled ||
    (slugOverride !== null && slugOverride.trim() !== initialSlug.trim())

  async function handleSave() {
    if (saving || !isDirty) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateDeliveryConfig({
        enabled,
        slug: slug.trim() || null,
      })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      onSaved()
      setEnabledOverride(null)
      setSlugOverride(null)
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  function handleAutoSlug() {
    if (!restaurant?.restaurant_name) return
    setSlugOverride(slugify(restaurant.restaurant_name))
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-stone-900">Delivery</h3>
      <p className="mt-1 text-xs font-medium text-stone-500">
        Activá delivery para aparecer en el directorio público y tener tu URL propia.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEnabledOverride(!enabled)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition ${
            enabled ? "bg-orange-500" : "bg-stone-200"
          }`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm font-semibold text-stone-900">
          {enabled ? "Delivery activado" : "Delivery desactivado"}
        </span>
      </div>

      {enabled && (
        <div className="mt-6 max-w-md">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-500">
            Identificador (slug)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlugOverride(e.target.value.toLowerCase())}
              placeholder="la-parrilla-de-benja"
              maxLength={60}
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-mono text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
            />
            {restaurant?.restaurant_name && (
              <button
                type="button"
                onClick={handleAutoSlug}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-50"
              >
                Sugerir
              </button>
            )}
          </div>
          {!initialSlug && slug.trim() && (
            <p className="mt-2 text-[11px] leading-4 text-stone-500">
              Tu URL pública será:{" "}
              <span className="font-mono font-semibold text-stone-700">
                {baseUrl}/restaurants/{slug.trim()}
              </span>
            </p>
          )}

          {initialSlug && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Tu URL pública
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-mono text-stone-700 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    copied
                      ? "bg-emerald-500 text-white"
                      : "bg-stone-900 text-white hover:bg-stone-800"
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copiado
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h4a2 2 0 002-2M8 5a2 2 0 012-2h4a2 2 0 012 2m2 0h2a2 2 0 012 2v3" />
                      </svg>
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-4 text-stone-500">
            Solo minúsculas, números y guiones. Debe ser único entre todos los locales de MESA.
          </p>
        </div>
      )}

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
          disabled={saving || !isDirty}
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {!isDirty && !saving && (
          <span className="text-xs font-medium text-stone-400">Sin cambios.</span>
        )}
      </div>
    </section>
  )
}

type OrderHandlingSectionProps = {
  restaurant: Restaurant | null
  onSaved: () => void
}

function OrderDestinationSection({ restaurant, onSaved }: OrderHandlingSectionProps) {
  const initial: OrderDestination = restaurant?.order_destination ?? "waiter"

  const [override, setOverride] = useState<OrderDestination | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  const destination: OrderDestination = override ?? initial
  const isDirty = destination !== initial

  async function handleSave() {
    if (saving || !isDirty) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateOrderDestination({ destination })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      onSaved()
      setOverride(null)
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-stone-900">Destino de pedidos</h3>
      <p className="mt-1 text-xs font-medium text-stone-500">
        Elegí si los pedidos pasan primero por un mesero o llegan directo a cocina.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOverride("waiter")}
          className={`rounded-2xl border p-4 text-left transition ${
            destination === "waiter" ? "border-orange-500 ring-2 ring-orange-200" : "border-stone-200 hover:border-stone-300"
          }`}
        >
          <p className="text-sm font-bold text-stone-900">Mesero</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Los pedidos inician en &quot;Nuevo&quot; y el mesero los confirma para que pasen a cocina.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setOverride("kitchen")}
          className={`rounded-2xl border p-4 text-left transition ${
            destination === "kitchen" ? "border-orange-500 ring-2 ring-orange-200" : "border-stone-200 hover:border-stone-300"
          }`}
        >
          <p className="text-sm font-bold text-stone-900">Cocina directa</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Los pedidos llegan en &quot;En preparación&quot; sin pasar por el mesero.
          </p>
        </button>
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
          disabled={saving || !isDirty}
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {!isDirty && !saving && (
          <span className="text-xs font-medium text-stone-400">Sin cambios.</span>
        )}
      </div>
    </section>
  )
}

const OUTPUT_OPTIONS: Array<{ id: OutputMode; title: string; description: string }> = [
  {
    id: "none",
    title: "Ninguna",
    description: "No se envía el pedido a impresora ni pantalla. Los meseros lo gestionan desde el panel.",
  },
  {
    id: "printer",
    title: "Impresora térmica",
    description: "Bluetooth (58/80mm). Cocina recibe un ticket cuando el pedido entra en preparación.",
  },
  {
    id: "screen",
    title: "Pantalla en cocina",
    description: "Vista kiosko en /screen para abrir en una TV o tablet en cocina.",
  },
]

function OutputModeSection({ restaurant, onSaved }: OrderHandlingSectionProps) {
  const initialMode: OutputMode = restaurant?.output_mode ?? "none"
  const initialDeviceName = restaurant?.printer_bluetooth_name ?? ""

  const [modeOverride, setModeOverride] = useState<OutputMode | null>(null)
  const [deviceNameOverride, setDeviceNameOverride] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  const mode = modeOverride ?? initialMode
  const deviceName = deviceNameOverride ?? initialDeviceName
  const isDirty =
    mode !== initialMode ||
    (mode === "printer" &&
      deviceNameOverride !== null &&
      deviceNameOverride.trim() !== initialDeviceName.trim())

  async function handleSave() {
    if (saving || !isDirty) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateOutputMode({
        mode,
        bluetoothName: mode === "printer" ? deviceName.trim() : null,
      })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      onSaved()
      setModeOverride(null)
      setDeviceNameOverride(null)
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-stone-900">Salida del pedido</h3>
      <p className="mt-1 text-xs font-medium text-stone-500">
        Elegí cómo recibe cocina los pedidos cuando entran en preparación.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {OUTPUT_OPTIONS.map((option) => {
          const selected = mode === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setModeOverride(option.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                selected ? "border-orange-500 ring-2 ring-orange-200" : "border-stone-200 hover:border-stone-300"
              }`}
            >
              <p className="text-sm font-bold text-stone-900">{option.title}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">{option.description}</p>
            </button>
          )
        })}
      </div>

      {mode === "printer" && (
        <div className="mt-6 max-w-md">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-500">
            Nombre del dispositivo (opcional)
          </label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceNameOverride(e.target.value)}
            placeholder="Ej. POS-58, MTP-II, RPP02N…"
            maxLength={80}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
          />
          <p className="mt-2 text-[11px] leading-4 text-stone-500">
            El emparejamiento se hace desde <span className="font-mono">/admin/printer</span> en el dispositivo del local
            (tablet o PC con Chrome/Edge). Si dejás vacío, vas a elegir la impresora desde el diálogo del navegador.
          </p>
        </div>
      )}

      {mode === "screen" && (
        <div className="mt-6 max-w-md rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs leading-5 text-stone-600">
            Abrí <span className="font-mono font-semibold">/screen</span> en la TV o tablet de cocina. Los pedidos
            van a aparecer ahí en grande cuando entren en preparación.
          </p>
        </div>
      )}

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
          disabled={saving || !isDirty}
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {!isDirty && !saving && (
          <span className="text-xs font-medium text-stone-400">Sin cambios.</span>
        )}
      </div>
    </section>
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
          Personalizá el nombre del restaurante y el template del menú.
        </p>
      </section>

      <RestaurantNameSection
        currentName={restaurant?.restaurant_name}
        onSaved={() => {
          if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
          refresh()
        }}
      />

      <RestaurantCitySection
        currentCity={restaurant?.restaurant_city}
        onSaved={() => {
          if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
          refresh()
        }}
      />

      <DeliverySection
        restaurant={restaurant ?? null}
        onSaved={() => {
          if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
          refresh()
        }}
      />

      <OrderDestinationSection
        restaurant={restaurant ?? null}
        onSaved={() => {
          if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
          refresh()
        }}
      />

      <OutputModeSection
        restaurant={restaurant ?? null}
        onSaved={() => {
          if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
          refresh()
        }}
      />

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
