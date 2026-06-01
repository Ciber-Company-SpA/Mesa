"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRestaurant } from "@/hooks/useRestaurant"
import { invalidateCache } from "@/hooks/useCache"
import { completeOnboarding } from "@/services/restaurant-service"

const DEFAULT_RESTAURANT_NAME = "Restaurante sin nombre"

export function OnboardingModal() {
  const { restaurant, loading, refresh } = useRestaurant()

  const [restaurantName, setRestaurantName] = useState("")
  const [adminName, setAdminName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading || !restaurant) return null
  if (restaurant.restaurant_name !== DEFAULT_RESTAURANT_NAME) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const result = await completeOnboarding({
        restaurantName: restaurantName.trim(),
        adminName: adminName.trim(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { admin_name: adminName.trim() },
      })
      if (updateError) {
        setError(`No se pudo actualizar la contraseña: ${updateError.message}`)
        return
      }
      if (restaurant) invalidateCache(`restaurant-${restaurant.id}`)
      invalidateCache("admin-profile")
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-2 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-xl font-bold shadow-inner">
            M
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
            Bienvenido a Mesa
          </p>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">
          Completá tu restaurante
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Antes de empezar necesitamos un par de datos. Vas a poder editar todo desde Ajustes.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-500">
              Nombre del restaurante
            </label>
            <input
              type="text"
              required
              maxLength={60}
              autoFocus
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Ej. Pizzería Roma"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-stone-500">
              Tu nombre
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-orange-700">
              Definí tu contraseña
            </p>
            <p className="mb-3 text-[11px] leading-4 text-stone-600">
              Por seguridad cambiá la contraseña temporal que te pasaron. Mínimo 8 caracteres.
            </p>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 pr-10 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                  aria-label={showPassword ? "Ocultar" : "Mostrar"}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>

              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmá la contraseña"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Comenzar"}
          </button>
        </form>
      </div>
    </div>
  )
}
