"use client"

import { useState } from "react"
import { useVentasStats, type Period } from "@/hooks/useVentasStats"

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

function KpiCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string
  value: string
  accent?: boolean
  loading: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        accent ? "border-orange-200 bg-orange-50" : "border-stone-200 bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-stone-200" />
      ) : (
        <p
          className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${
            accent ? "text-orange-700" : "text-stone-900"
          }`}
        >
          {value}
        </p>
      )}
    </div>
  )
}

function BarChart({
  labels,
  values,
  loading,
}: {
  labels: string[]
  values: number[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-end gap-1 h-40">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t-md bg-stone-200"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    )
  }

  const max = Math.max(...values, 1)
  const hasData = values.some((v) => v > 0)

  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl bg-stone-50">
        <p className="text-sm font-medium text-stone-400">Sin ventas en este período</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-0 items-end gap-1" style={{ height: "10rem" }}>
        {labels.map((label, i) => {
          const heightPct = Math.round((values[i] / max) * 100)
          return (
            <div
              key={label}
              className="flex flex-1 min-w-[18px] flex-col items-center justify-end gap-1"
              style={{ height: "100%" }}
            >
              <div
                className={`w-full rounded-t-md transition-all duration-300 ${
                  heightPct > 0 ? "bg-orange-400" : "bg-stone-100"
                }`}
                style={{ height: `${Math.max(heightPct, heightPct > 0 ? 4 : 0)}%` }}
                title={formatPeso(values[i])}
              />
              <span className="block w-full truncate text-center text-[8px] font-medium text-stone-400">
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function VentasPage() {
  const [period, setPeriod] = useState<Period>("hoy")
  const { stats, loading } = useVentasStats(period)

  const totalVentas = stats?.totalVentas ?? 0
  const pedidosCerrados = stats?.pedidosCerrados ?? 0
  const ticketPromedio = stats?.ticketPromedio ?? 0
  const horaPico = stats?.horaPico ?? "–"
  const chartLabels = stats?.chartLabels ?? []
  const chartValues = stats?.chartValues ?? []

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Ventas</h2>
        <p className="mt-1 text-sm text-stone-500">
          Resumen de ingresos y actividad por período.
        </p>
      </section>

      <PeriodSelector period={period} onChange={setPeriod} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total ventas" value={formatPeso(totalVentas)} loading={loading} />
        <KpiCard label="Pedidos cerrados" value={String(pedidosCerrados)} loading={loading} />
        <KpiCard label="Ticket promedio" value={formatPeso(ticketPromedio)} loading={loading} />
        <KpiCard label="Hora pico" value={horaPico} accent loading={loading} />
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-stone-500">
          {period === "hoy" ? "Ventas por hora" : "Ventas por día"}
        </h3>
        <BarChart labels={chartLabels} values={chartValues} loading={loading} />
      </section>
    </div>
  )
}
