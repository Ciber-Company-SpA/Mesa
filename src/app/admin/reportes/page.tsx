"use client"

import { useState } from "react"
import { useTopProductos } from "@/hooks/useTopProductos"
import { useHistorialPedidos } from "@/hooks/useHistorialPedidos"
import type { Period } from "@/hooks/useVentasStats"

function formatPeso(value: number) {
  return `$${value.toLocaleString("es-CL")}`
}

function PeriodSelector({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const options: { value: Period; label: string }[] = [
    { value: "hoy", label: "Hoy" },
    { value: "semana", label: "Esta semana" },
    { value: "mes", label: "Este mes" },
  ]
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            period === o.value
              ? "bg-stone-900 text-white shadow-sm"
              : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function ReportesPage() {
  const [period, setPeriod] = useState<Period>("hoy")
  const { productos, loading: loadingProductos } = useTopProductos(period)
  const { historial, loading: loadingHistorial } = useHistorialPedidos(period)

  const ventasPorMesa = Object.entries(
    historial.reduce<Record<string, number>>((acc, h) => {
      acc[h.tableLabel] = (acc[h.tableLabel] ?? 0) + h.total
      return acc
    }, {})
  ).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Reportes</h2>
        <p className="mt-1 text-sm text-stone-500">
          Desglose de productos, mesas e historial de pedidos cerrados.
        </p>
      </section>

      <PeriodSelector period={period} onChange={setPeriod} />

      {/* Top 5 productos */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Top 5 productos más vendidos</h3>
        <p className="mt-1 text-xs font-medium text-stone-500">Por cantidad de unidades vendidas.</p>

        <div className="mt-5 space-y-4">
          {loadingProductos ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-4 animate-pulse rounded bg-stone-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-stone-200" />
                  <div className="h-2 w-full animate-pulse rounded-full bg-stone-100" />
                </div>
              </div>
            ))
          ) : productos.length === 0 ? (
            <p className="py-4 text-center text-sm font-medium text-stone-400">
              Sin ventas en este período
            </p>
          ) : (
            productos.map((p, i) => {
              const maxQty = productos[0]?.totalQuantity ?? 1
              const barPct = Math.round((p.totalQuantity / maxQty) * 100)
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-xs font-bold text-stone-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-stone-900">{p.name}</span>
                      <span className="text-xs font-medium text-stone-500">
                        {p.totalQuantity} uds · {formatPeso(p.totalRevenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-stone-100">
                      <div
                        className="h-2 rounded-full bg-orange-400 transition-all duration-500"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Ventas por mesa */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Ventas por mesa</h3>
        <p className="mt-1 text-xs font-medium text-stone-500">Total acumulado de pedidos pagados.</p>

        <div className="mt-5">
          {loadingHistorial ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-100" />
              ))}
            </div>
          ) : ventasPorMesa.length === 0 ? (
            <p className="py-4 text-center text-sm font-medium text-stone-400">
              Sin ventas en este período
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ventasPorMesa.map(([mesa, total]) => (
                <div
                  key={mesa}
                  className="rounded-2xl border border-stone-100 bg-stone-50 p-4"
                >
                  <p className="text-xs font-semibold text-stone-500">{mesa}</p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums text-stone-900">
                    {formatPeso(total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Historial de pedidos */}
      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Historial de pedidos</h3>
        <p className="mt-1 text-xs font-medium text-stone-500">
          Últimos 30 pedidos cerrados del período.
        </p>

        <div className="mt-5 overflow-x-auto">
          {loadingHistorial ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-xl bg-stone-100" />
              ))}
            </div>
          ) : historial.length === 0 ? (
            <p className="py-4 text-center text-sm font-medium text-stone-400">
              Sin pedidos cerrados en este período
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-stone-400">
                    Fecha / hora
                  </th>
                  <th className="pb-3 pr-4 font-bold uppercase tracking-wider text-stone-400">
                    Mesa
                  </th>
                  <th className="pb-3 pr-4 text-right font-bold uppercase tracking-wider text-stone-400">
                    Items
                  </th>
                  <th className="pb-3 text-right font-bold uppercase tracking-wider text-stone-400">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {historial.map((h) => (
                  <tr key={h.id} className="hover:bg-stone-50">
                    <td className="py-3 pr-4 font-medium text-stone-500">{h.timeLabel}</td>
                    <td className="py-3 pr-4 font-semibold text-stone-900">{h.tableLabel}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-stone-500">
                      {h.itemsCount}
                    </td>
                    <td className="py-3 text-right font-bold tabular-nums text-stone-900">
                      {formatPeso(h.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
