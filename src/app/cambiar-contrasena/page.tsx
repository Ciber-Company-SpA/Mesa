"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { getHomeRouteForRole, roleIdToRole } from "@/lib/waiter-session"

/**
 * Cambio obligatorio de contraseña. El proxy redirige aquí a cualquier usuario
 * con must_change_password = true; el login (admin y mesero) también. El flag
 * solo se limpia al fijar una contraseña nueva vía la edge function
 * change-my-password (service_role); el cliente no puede tocarlo.
 */
export default function CambiarContrasenaPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [homeRoute, setHomeRoute] = useState("/waiter/control")
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }
      const { data: profile } = await supabase
        .from("users")
        .select("role_id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
      const route = getHomeRouteForRole(roleIdToRole(profile?.role_id ?? 1))
      if (!active) return
      setHomeRoute(route)

      const { data: mustChange } = await supabase.rpc("get_my_must_change_password")
      if (!active) return
      if (mustChange !== true) {
        router.replace(route)
        return
      }
      setReady(true)
    }
    init()
    return () => { active = false }
  }, [router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden")
      return
    }
    try {
      setLoading(true)
      setError("")
      const { data, error: fnErr } = await supabase.functions.invoke("change-my-password", {
        body: { newPassword },
      })
      if (fnErr || !data?.ok) {
        setError(data?.error ?? "No se pudo cambiar la contraseña. Intentá de nuevo.")
        return
      }
      router.replace(homeRoute)
    } catch (err) {
      logger.error("Error en cambio obligatorio de contraseña", err)
      setError("Error al cambiar la contraseña")
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F5] text-sm font-semibold text-stone-600">
        Cargando...
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FAF9F5] p-6 font-sans text-stone-900">
      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-orange-100/40 blur-3xl" />
      <div className="mb-8 max-w-md text-center">
        <span className="rounded-full border border-orange-200/50 bg-orange-50 px-3 py-1 text-[10px] font-bold tracking-widest text-orange-600 uppercase">
          Seguridad
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900">Define tu contraseña</h1>
        <p className="mt-2 text-sm text-stone-500">
          Por seguridad, reemplazá la contraseña temporal por una propia antes de continuar.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-[2rem] border border-stone-200/80 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-stone-700">
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              disabled={loading}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold text-stone-700">
              Confirmar contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              disabled={loading}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </main>
  )
}
