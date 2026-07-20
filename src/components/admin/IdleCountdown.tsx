"use client"

import { useEffect, useState } from "react"
import { idleRemainingMs, IDLE_TOTAL_MS } from "@/lib/idle-monitor"

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Cronómetro de la cuenta regresiva de inactividad, para el pie del sidebar del
 * panel admin. Lee del monitor compartido (mismo reloj que el aviso de cierre).
 * Se pone en ámbar en los últimos 2 minutos.
 */
export function IdleCountdown({ collapsed = false }: { collapsed?: boolean }) {
  const [ms, setMs] = useState(IDLE_TOTAL_MS)

  useEffect(() => {
    const iv = setInterval(() => setMs(idleRemainingMs()), 1000)
    return () => clearInterval(iv)
  }, [])

  const low = ms <= 2 * 60 * 1000

  return (
    <div className="border-t border-stone-100 p-2">
      <div
        title="Tiempo restante antes del cierre por inactividad"
        className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${collapsed ? "justify-center" : ""} ${
          low ? "bg-amber-50" : ""
        }`}
      >
        <svg
          className={`h-4 w-4 shrink-0 ${low ? "text-amber-600" : "text-stone-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {!collapsed && (
          <span className={`text-[11px] font-medium ${low ? "text-amber-700" : "text-stone-400"}`}>Sesión</span>
        )}
        <span className={`${collapsed ? "" : "ml-auto"} text-xs font-bold tabular-nums ${low ? "text-amber-700" : "text-stone-600"}`}>
          {fmt(ms)}
        </span>
      </div>
    </div>
  )
}
