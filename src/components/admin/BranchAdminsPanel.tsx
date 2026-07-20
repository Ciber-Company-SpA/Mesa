"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Admin = { user_id: number; auth_user_id: string; name: string; email: string }

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"

/**
 * Panel para que el DUEÑO gestione los administradores de UNA sucursal: listar,
 * crear (login propio, acceso directo solo a ese local), resetear contraseña y
 * revocar. Las credenciales se muestran una sola vez.
 */
export function BranchAdminsPanel({
  restaurantId,
  restaurantName,
  onClose,
}: {
  restaurantId: number
  restaurantName: string
  onClose: () => void
}) {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cred, setCred] = useState<{ title: string; email: string; password: string } | null>(null)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("list_branch_admins", { p_restaurant_id: restaurantId })
    if (err) setError(err.message)
    else setAdmins((data ?? []) as Admin[])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar
    void reload()
  }, [reload])

  async function createAdmin() {
    if (!email.trim() || !email.includes("@")) {
      setError("Ingresá un correo válido para el administrador.")
      return
    }
    setBusy(true)
    setError("")
    const { data, error: err } = await supabase.functions.invoke("provision-branch-admin", {
      body: { name: name.trim(), email: email.trim(), restaurantId },
    })
    setBusy(false)
    if (err) {
      setError("No se pudo crear el administrador.")
      return
    }
    if (!data?.ok) {
      setError(data?.error ?? "No se pudo crear el administrador.")
      return
    }
    setCred({ title: "Acceso creado", email: email.trim(), password: data.password })
    setName("")
    setEmail("")
    setShowCreate(false)
    await reload()
  }

  async function resetPassword(a: Admin) {
    if (!window.confirm(`¿Resetear la contraseña de ${a.email}? Deberá cambiarla al ingresar.`)) return
    setBusy(true)
    setError("")
    const { data, error: err } = await supabase.functions.invoke("reset-branch-admin-password", {
      body: { userId: a.user_id },
    })
    setBusy(false)
    if (err || !data?.ok) {
      setError(data?.error ?? "No se pudo resetear la contraseña.")
      return
    }
    setCred({ title: "Contraseña reseteada", email: a.email, password: data.password })
  }

  async function revoke(a: Admin) {
    if (!window.confirm(`¿Revocar el acceso de ${a.email}? Perderá el acceso a este local.`)) return
    setBusy(true)
    setError("")
    const { error: err } = await supabase.rpc("revoke_branch_admin", { p_user_id: a.user_id })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await reload()
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-stone-900">Administradores de {restaurantName}</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Cada uno entra directo a este local con su propio acceso, sin ver las otras sucursales.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-bold text-stone-500 hover:text-stone-800">
          Cerrar
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
      )}

      {cred && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">{cred.title} — se muestra una sola vez</p>
          <p className="mt-1 text-xs text-amber-800/90">
            Entregá estas credenciales al administrador del local; al ingresar se le pedirá cambiar la contraseña.
          </p>
          <div className="mt-2 space-y-1 text-sm">
            <p><span className="font-semibold text-stone-600">Correo:</span> <span className="text-stone-900">{cred.email}</span></p>
            <p><span className="font-semibold text-stone-600">Contraseña:</span> <span className="font-mono text-stone-900">{cred.password}</span></p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(`Correo: ${cred.email}\nContraseña: ${cred.password}`).catch(() => {})}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-700 transition hover:bg-stone-50"
          >
            Copiar
          </button>
          <button type="button" onClick={() => setCred(null)} className="ml-2 text-[11px] font-bold text-stone-500 hover:text-stone-800">
            Listo
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="py-4 text-center text-xs text-stone-400">Cargando…</p>
        ) : admins.length === 0 ? (
          <p className="py-3 text-center text-xs text-stone-400">Este local aún no tiene administradores propios.</p>
        ) : (
          <ul className="space-y-2">
            {admins.map((a) => (
              <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">{a.name || "Administrador"}</p>
                  <p className="truncate text-xs text-stone-500">{a.email}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => resetPassword(a)}
                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
                  >
                    Resetear clave
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => revoke(a)}
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    Revocar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate ? (
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
          <p className="text-xs font-bold text-stone-900">Nuevo administrador de local</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-stone-600">
              Nombre
              <input className={`mt-1 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan Pérez" />
            </label>
            <label className="text-xs font-semibold text-stone-600">
              Correo *
              <input type="email" className={`mt-1 ${inputCls}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@local.cl" />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-50">
              Cancelar
            </button>
            <button type="button" disabled={busy} onClick={createAdmin} className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:opacity-50">
              {busy ? "Creando…" : "Crear acceso"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => { setShowCreate(true); setCred(null) }}
            className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600"
          >
            + Nuevo administrador
          </button>
        </div>
      )}
    </section>
  )
}
