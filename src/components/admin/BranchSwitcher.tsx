"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { clearUserScopedCache } from "@/lib/session-cache"

type Row = {
  id: number
  restaurant_name: string
  is_active: boolean
}

/**
 * Selector de local para dueños multi-sucursal. Solo aparece si el usuario
 * posee más de un restaurante (list_my_restaurants). Al elegir otro local,
 * cambia el "local activo" (set_active_restaurant), limpia el caché de sesión
 * y recarga el panel sobre la nueva sucursal.
 */
export function BranchSwitcher() {
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    supabase.rpc("list_my_restaurants").then(({ data }) => {
      if (active && Array.isArray(data)) setRows(data as Row[])
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Con un solo local no hay nada que cambiar.
  if (rows.length <= 1) return null

  const current = rows.find((r) => r.is_active)

  async function switchTo(id: number) {
    if (switching !== null) return
    setSwitching(id)
    const { error } = await supabase.rpc("set_active_restaurant", { p_restaurant_id: id })
    if (error) {
      setSwitching(null)
      return
    }
    // Recarga completa: todo el panel debe reconstruirse sobre el nuevo local.
    clearUserScopedCache()
    window.location.assign("/admin")
  }

  return (
    <div ref={ref} className="relative mx-3 mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-left text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
      >
        <span className="min-w-0 truncate">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Local · </span>
          {current?.restaurant_name ?? "Elegir local"}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={switching !== null}
              onClick={() => (r.is_active ? setOpen(false) : switchTo(r.id))}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:opacity-60 ${
                r.is_active ? "bg-orange-50 font-bold text-orange-700" : "text-stone-700 hover:bg-stone-50"
              }`}
            >
              <span className="min-w-0 truncate">{r.restaurant_name}</span>
              {r.is_active ? (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-orange-600">Actual</span>
              ) : switching === r.id ? (
                <span className="shrink-0 text-[10px] text-stone-400">Cambiando…</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
