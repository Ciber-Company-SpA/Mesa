"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { clearUserScopedCache } from "@/lib/session-cache"

// 30 min de inactividad → aviso con 15 s de gracia → cierre de sesión.
const IDLE_MS = 30 * 60 * 1000
const GRACE = 15
const ACTIVITY = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"]

/**
 * Auto-cierre por inactividad del panel admin del cliente. Montado en
 * /admin/layout. La actividad reinicia el contador de 30 min; al expirar avisa
 * con cuenta regresiva de 15 s y, si no se confirma, cierra la sesión.
 * (No se usa en la app del mesero, que opera todo el turno.)
 */
export function AdminSessionTimeout() {
  const router = useRouter()
  const [warning, setWarning] = useState(false)
  const [count, setCount] = useState(GRACE)
  const lastActivity = useRef(0)
  const warningRef = useRef(false)

  useEffect(() => {
    warningRef.current = warning
  }, [warning])

  const doLogout = useCallback(async () => {
    try {
      supabase.removeAllChannels()
      clearUserScopedCache()
      await supabase.auth.signOut({ scope: "local" })
    } catch {
      // Ignorar: igual redirigimos al login.
    }
    router.replace("/login")
  }, [router])

  useEffect(() => {
    lastActivity.current = Date.now()
    const bump = () => {
      if (!warningRef.current) lastActivity.current = Date.now()
    }
    ACTIVITY.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const iv = setInterval(() => {
      if (warningRef.current) return
      if (Date.now() - lastActivity.current >= IDLE_MS) {
        setCount(GRACE)
        setWarning(true)
      }
    }, 1000)
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(iv)
    }
  }, [])

  useEffect(() => {
    if (!warning) return
    let n = GRACE
    const iv = setInterval(() => {
      n -= 1
      setCount(n)
      if (n <= 0) {
        clearInterval(iv)
        void doLogout()
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [warning, doLogout])

  const stay = useCallback(() => {
    lastActivity.current = Date.now()
    setWarning(false)
  }, [])

  if (!warning) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">¿Sigues ahí?</h2>
        <p className="mt-2 text-sm text-stone-600">
          Por seguridad, tu sesión se cerrará por inactividad en{" "}
          <span className="font-bold tabular-nums text-red-600">{count}</span> segundos.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void doLogout()}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-600 transition hover:bg-stone-50"
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={stay}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-orange-600"
          >
            Seguir conectado
          </button>
        </div>
      </div>
    </div>
  )
}
