"use client"

import Link from "next/link"
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts"
import { useVisibleModules } from "@/hooks/useVisibleModules"

/**
 * Aviso de inventario para el Dashboard de inicio. Aparece SOLO cuando hay
 * insumos críticos y el módulo de inventario está habilitado por el operador.
 * Rojo si hay agotados; ámbar si solo hay stock bajo.
 */
export function InventoryAlertCard() {
  const { outCount, lowCount, totalCount } = useInventoryAlerts()
  const { isVisible } = useVisibleModules()

  if (!isVisible("admin", "inventory")) return null
  if (totalCount === 0) return null

  const hasOut = outCount > 0
  const tone = hasOut
    ? { border: "border-red-200", bg: "bg-red-50", icon: "bg-red-100 text-red-700", title: "text-red-800", sub: "text-red-600", arrow: "text-red-700" }
    : { border: "border-amber-200", bg: "bg-amber-50", icon: "bg-amber-100 text-amber-700", title: "text-amber-800", sub: "text-amber-600", arrow: "text-amber-700" }

  const parts: string[] = []
  if (outCount > 0) parts.push(`${outCount} sin stock`)
  if (lowCount > 0) parts.push(`${lowCount} bajo el mínimo`)

  return (
    <Link
      href="/admin/inventory"
      className={`group flex items-center gap-4 rounded-3xl border ${tone.border} ${tone.bg} p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${tone.icon}`}>
        ⚠️
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${tone.title}`}>Atención en el inventario</p>
        <p className={`mt-0.5 text-xs font-medium ${tone.sub}`}>
          {parts.join(" · ")} — revisa y repón tus insumos →
        </p>
      </div>
      <span className={`text-lg ${tone.arrow} transition group-hover:translate-x-0.5`}>→</span>
    </Link>
  )
}
