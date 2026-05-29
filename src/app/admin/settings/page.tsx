"use client"

import { useEffect, useState } from "react"
import { useRestaurant } from "@/hooks/useRestaurant"
import { invalidateCache } from "@/hooks/useCache"
import { updateMenuTemplate } from "@/services/restaurant-service"
import { MENU_TEMPLATES } from "@/lib/menu/templates"
import type { MenuTemplate } from "@/types/restaurant"

export default function AdminSettingsPage() {
  const { restaurant, loading } = useRestaurant()

  const [selected, setSelected] = useState<MenuTemplate>("noche")
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (!restaurant) return
    setSelected(restaurant.menu_template ?? "noche")
  }, [restaurant])

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
      setFeedback({ kind: "ok", message: "Cambios guardados" })
    } finally {
      setSaving(false)
    }
  }

  const currentTemplate = restaurant?.menu_template ?? "noche"
  const isDirty = selected !== currentTemplate

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Ajustes</h2>
        <p className="mt-1 text-sm text-stone-500">
          Elegí el template del menú que ven tus clientes al escanear el QR.
        </p>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-900">Template del menú</h3>
        <p className="mt-1 text-xs font-medium text-stone-500">
          Próximamente más templates disponibles.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MENU_TEMPLATES.map((template) => {
            const isSelected = selected === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelected(template.id)}
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  isSelected
                    ? "border-orange-500 ring-2 ring-orange-200"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="relative h-32 w-full" style={{ background: template.swatch }}>
                  {isSelected && (
                    <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="p-4">
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
      </section>
    </div>
  )
}
