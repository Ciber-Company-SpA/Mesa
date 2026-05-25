"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"
import { isAdminRole, roleIdToRole } from "@/lib/waiter-session"

type View = "login" | "change-password"

export default function WaiterLoginPage() {
  const router = useRouter()

  const [view, setView] = useState<View>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sessionChecked, setSessionChecked] = useState(false)

  // Si ya hay sesión de mesero/cocina/caja, salta directo a /waiter/control.
  // Si la sesión es de admin, NO redirigimos: el admin pudo haber llegado acá
  // queriendo loguearse como mesero. La sesión actual queda viva hasta que
  // efectivamente complete el login de mesero (ahí signIn la reemplaza).
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const mustChange = user.user_metadata?.must_change_password === true
        if (mustChange) {
          setView("change-password")
        } else {
          const { data: profile } = await supabase
            .from("users")
            .select("role_id")
            .eq("auth_user_id", user.id)
            .single()
          const role = roleIdToRole(profile?.role_id ?? 1)
          if (!isAdminRole(role)) {
            router.replace("/waiter/control")
            return
          }
        }
      }
      setSessionChecked(true)
    }
    checkSession()
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    try {
      setLoading(true)
      setError("")

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        if (signInError.message?.toLowerCase().includes("invalid login")) {
          setError("Correo o contraseña incorrectos")
        } else {
          setError(signInError.message)
        }
        return
      }

      const user = data.user
      if (!user) {
        setError("No se pudo iniciar sesión")
        return
      }

      // Rechazar credenciales de admin/manager en este portal.
      const { data: profile } = await supabase
        .from("users")
        .select("role_id")
        .eq("auth_user_id", user.id)
        .single()
      const role = roleIdToRole(profile?.role_id ?? 1)
      if (isAdminRole(role)) {
        await supabase.auth.signOut()
        setError("Esta cuenta es de administrador. Ingresa en el portal de admin.")
        return
      }

      const mustChange = user.user_metadata?.must_change_password === true
      if (mustChange) {
        setView("change-password")
        setPassword("") // limpiamos para que no aparezca prellenado
        return
      }

      router.replace("/waiter/control")
    } catch (err) {
      if (isNetworkError(err)) {
        setError("Sin conexión. Verifica tu internet.")
        return
      }
      logger.error("Error en login de mesero", err)
      setError("Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    try {
      setLoading(true)
      setError("")

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      router.replace("/waiter/control")
    } catch (err) {
      if (isNetworkError(err)) {
        setError("Sin conexión")
        return
      }
      logger.error("Error cambiando password de mesero", err)
      setError("Error al cambiar la contraseña")
    } finally {
      setLoading(false)
    }
  }

  if (!sessionChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F5] text-sm font-semibold text-stone-600">
        Cargando...
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FAF9F5] p-6 font-sans text-stone-900">
      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-orange-100/40 blur-3xl" />
      <div className="absolute top-1/3 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-orange-50/20 blur-3xl" />

      <div className="mb-8 max-w-md text-center">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm transition hover:border-stone-400"
        >
          MESA
        </Link>
        <span className="rounded-full border border-orange-200/50 bg-orange-50 px-3 py-1 text-[10px] font-bold tracking-widest text-orange-600 uppercase">
          Portal meseros
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900">
          {view === "login" ? "Bienvenido" : "Define tu contraseña"}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {view === "login"
            ? "Ingresa con el correo y contraseña que te compartió tu administrador."
            : "Es tu primer ingreso. Reemplaza la contraseña temporal por una propia."}
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-[2rem] border border-stone-200/80 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
        {view === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="waiter-email" className="mb-1.5 block text-xs font-semibold text-stone-700">
                Correo
              </label>
              <input
                id="waiter-email"
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@restaurante.com"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="waiter-password" className="block text-xs font-semibold text-stone-700">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] font-semibold text-orange-600 transition hover:text-orange-700"
                >
                  ¿La olvidaste?
                </Link>
              </div>
              <input
                id="waiter-password"
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-stone-700">
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
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
                minLength={6}
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? "Guardando..." : "Guardar y entrar"}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
