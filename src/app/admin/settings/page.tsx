"use client"

import { useEffect, useState } from "react"
import { useRestaurant } from "@/hooks/useRestaurant"
import { invalidateCache } from "@/hooks/useCache"
import { updateMenuHeaderStyle } from "@/services/restaurant-service"
import type { MenuHeaderType } from "@/types/restaurant"

const DEFAULT_COLOR_1 = "#0c0a09"
const DEFAULT_COLOR_2 = "#1c1917"

export default function AdminSettingsPage() {
  const { restaurant, loading } = useRestaurant()

  const [type, setType] = useState<MenuHeaderType>("solid")
  const [color1, setColor1] = useState(DEFAULT_COLOR_1)
  const [color2, setColor2] = useState(DEFAULT_COLOR_2)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (!restaurant) return
    setType(restaurant.menu_header_type ?? "solid")
    setColor1(restaurant.menu_header_color_1 ?? DEFAULT_COLOR_1)
    setColor2(restaurant.menu_header_color_2 ?? DEFAULT_COLOR_2)
  }, [restaurant])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await updateMenuHeaderStyle({
        type,
        color1,
        color2: type === "gradient" ? color2 : null,
      })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  const previewBackground = type === "gradient"
    ? `linear-gradient(180deg, ${color1} 0%, ${color2} 100%)`
    : color1

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Ajustes</h2>
        <p className="mt-1 text-sm text-stone-500">
          Personaliza la apariencia del menú que ven tus clientes al escanear el QR.
        </p>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-900">Color del menú</h3>
        <p className="mt-1 text-xs font-medium text-stone-500">
          Elegí un color plano o un gradiente para el fondo del menú público.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Tipo</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("solid")}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    type === "solid"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  }`}
                >
                  Plano
                </button>
                <button
                  type="button"
                  onClick={() => setType("gradient")}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    type === "gradient"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                  }`}
                >
                  Gradiente
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-500">
                {type === "gradient" ? "Color superior" : "Color"}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color1}
                  onChange={(e) => setColor1(e.target.value)}
                  className="h-12 w-16 cursor-pointer rounded-lg border border-stone-200"
                />
                <input
                  type="text"
                  value={color1}
                  onChange={(e) => setColor1(e.target.value)}
                  className="w-32 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-mono text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            {type === "gradient" && (
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-500">
                  Color inferior
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color2}
                    onChange={(e) => setColor2(e.target.value)}
                    className="h-12 w-16 cursor-pointer rounded-lg border border-stone-200"
                  />
                  <input
                    type="text"
                    value={color2}
                    onChange={(e) => setColor2(e.target.value)}
                    className="w-32 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-mono text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>
            )}

            {feedback && (
              <p
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  feedback.kind === "ok"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback.message}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Vista previa</p>
            <div
              className="aspect-[9/16] w-full overflow-hidden rounded-3xl border border-stone-200 p-5 text-white shadow-inner"
              style={{ background: previewBackground }}
            >
              <p className="text-xs font-semibold text-orange-200/80">Mesa 1</p>
              <h4 className="mt-1 text-2xl font-black tracking-tight">
                {restaurant?.restaurant_name ?? "Mi Restaurante"}
              </h4>
              <div className="mt-6 flex gap-2">
                <span className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black text-stone-950">
                  Todo
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-stone-200 ring-1 ring-white/10">
                  Refrescos
                </span>
              </div>
              <div className="mt-5 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <p className="text-[10px] font-bold text-orange-200/80">Refrescos</p>
                <p className="text-sm font-black">Café</p>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
