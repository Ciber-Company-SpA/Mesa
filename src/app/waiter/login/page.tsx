"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError } from "@/hooks/useOfflineRetry"
import { getHomeRouteForRole, isAdminRole, roleIdToRole } from "@/lib/waiter-session"
import { clearUserScopedCache } from "@/lib/session-cache"
import { InstallPwaButton } from "@/components/InstallPwaButton"

type View = "login" | "change-password"

async function fetchProfileRoleIdWithRetry(authUserId: string): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("users")
      .select("role_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle()
    if (!error && data?.role_id != null) return data.role_id
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
  }
  return null
}

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
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Si ya hay sesión de mesero/cocina/caja, salta directo a /waiter/control.
  // Si la sesión es de admin, NO redirigimos: el admin pudo haber llegado acá
  // queriendo loguearse como mesero. La sesión actual queda viva hasta que
  // efectivamente complete el login de mesero (ahí signIn la reemplaza).
  useEffect(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      const canonicalLoginUrl = new URL("/waiter/login", appUrl)
      if (window.location.origin !== canonicalLoginUrl.origin) {
        window.location.replace(canonicalLoginUrl.toString())
        return
      }
    }

    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: mustChange } = await supabase.rpc("get_my_must_change_password")
        if (mustChange === true) {
          setView("change-password")
        } else {
          const { data: profile } = await supabase
            .from("users")
            .select("role_id")
            .eq("auth_user_id", user.id)
            .single()
          const role = roleIdToRole(profile?.role_id ?? 1)
          if (!isAdminRole(role)) {
            router.replace(getHomeRouteForRole(role))
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

      // Limpia cache de la sesión anterior antes de leer el perfil nuevo.
      clearUserScopedCache()

      // Rechazar credenciales de admin/manager en este portal. Reintentamos la
      // lectura del perfil porque hay race conocida entre signInWithPassword
      // y la propagación del JWT a PostgREST.
      const profileRoleId = await fetchProfileRoleIdWithRetry(user.id)
      if (profileRoleId == null) {
        setError("No se pudo verificar tu cuenta. Reintentá en unos segundos.")
        return
      }
      const role = roleIdToRole(profileRoleId)
      if (isAdminRole(role)) {
        await supabase.auth.signOut()
        clearUserScopedCache()
        setError("Esta cuenta es de administrador. Ingresa en el portal de admin.")
        return
      }

      const { data: mustChange } = await supabase.rpc("get_my_must_change_password")
      if (mustChange === true) {
        setView("change-password")
        setPassword("") // limpiamos para que no aparezca prellenado
        return
      }

      router.replace(getHomeRouteForRole(role))
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

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    try {
      setLoading(true)
      setError("")

      // El cambio + limpieza del flag ocurre server-side (service_role); el
      // cliente no puede limpiar must_change_password por su cuenta.
      const { data, error: fnError } = await supabase.functions.invoke("change-my-password", {
        body: { newPassword },
      })

      if (fnError || !data?.ok) {
        setError(data?.error ?? "No se pudo cambiar la contraseña")
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
              <div className="relative">
                <input
                  id="waiter-password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 pr-10 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-stone-500 transition hover:text-stone-800 disabled:opacity-50"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.55 19.55 0 0 1 5.06-6.06" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.62 19.62 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
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

            <InstallPwaButton />
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-stone-700">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={8}
                  disabled={loading}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 pr-10 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-stone-500 transition hover:text-stone-800 disabled:opacity-50"
                >
                  {showNewPassword ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.55 19.55 0 0 1 5.06-6.06" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.62 19.62 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold text-stone-700">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 pr-10 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-stone-500 transition hover:text-stone-800 disabled:opacity-50"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.55 19.55 0 0 1 5.06-6.06" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.62 19.62 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
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
