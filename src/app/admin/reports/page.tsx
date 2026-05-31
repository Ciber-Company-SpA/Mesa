"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  getSalesReport,
  type ReportRange,
  type SalesSummary,
  type TopProduct,
  type SalesByTable,
  type TimeBucket,
} from "@/services/report-service"

type PresetId = "today" | "week" | "month" | "3m" | "year" | "custom"

type Preset = {
  id: PresetId
  label: string
  build: () => Pick<ReportRange, "from" | "to" | "granularity">
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function addMonths(d: Date, n: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

const PRESETS: Preset[] = [
  {
    id: "today",
    label: "Hoy",
    build: () => {
      const from = startOfDay(new Date())
      const to = addDays(from, 1)
      return { from: from.toISOString(), to: to.toISOString(), granularity: "hour" }
    },
  },
  {
    id: "week",
    label: "Semana",
    build: () => {
      const today = startOfDay(new Date())
      const day = today.getDay() === 0 ? 6 : today.getDay() - 1
      const from = addDays(today, -day)
      const to = addDays(today, 1)
      return { from: from.toISOString(), to: to.toISOString(), granularity: "day" }
    },
  },
  {
    id: "month",
    label: "Mes",
    build: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      const to = addDays(startOfDay(new Date()), 1)
      return { from: from.toISOString(), to: to.toISOString(), granularity: "day" }
    },
  },
  {
    id: "3m",
    label: "3 meses",
    build: () => {
      const today = startOfDay(new Date())
      const from = addMonths(today, -3)
      const to = addDays(today, 1)
      return { from: from.toISOString(), to: to.toISOString(), granularity: "month" }
    },
  },
  {
    id: "year",
    label: "Año",
    build: () => {
      const today = startOfDay(new Date())
      const from = addMonths(today, -12)
      const to = addDays(today, 1)
      return { from: from.toISOString(), to: to.toISOString(), granularity: "month" }
    },
  },
]

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`
}

function formatBucket(bucket: string, granularity: ReportRange["granularity"]) {
  const d = new Date(bucket)
  if (granularity === "hour") {
    return d.toLocaleTimeString("es-CL", { hour: "2-digit" })
  }
  if (granularity === "day") {
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })
  }
  return d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" })
}

export default function ReportsPage() {
  const [presetId, setPresetId] = useState<PresetId>("today")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [salesByTable, setSalesByTable] = useState<SalesByTable[]>([])
  const [timeline, setTimeline] = useState<TimeBucket[]>([])

  const range = useMemo<ReportRange | null>(() => {
    if (presetId === "custom") {
      if (!customFrom || !customTo) return null
      const from = startOfDay(new Date(customFrom))
      const to = addDays(startOfDay(new Date(customTo)), 1)
      const days = Math.round((to.getTime() - from.getTime()) / 86400000)
      const granularity: ReportRange["granularity"] = days <= 2 ? "hour" : days <= 90 ? "day" : "month"
      return { from: from.toISOString(), to: to.toISOString(), granularity }
    }
    const preset = PRESETS.find((p) => p.id === presetId)
    return preset ? preset.build() : null
  }, [presetId, customFrom, customTo])

  useEffect(() => {
    if (!range) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getSalesReport(range)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setError(res.error)
          return
        }
        setSummary(res.data.summary)
        setTopProducts(res.data.topProducts)
        setSalesByTable(res.data.salesByTable)
        setTimeline(res.data.timeline)
      })
      .catch(() => {
        if (!cancelled) setError("Error inesperado")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range])

  const chartData = timeline.map((t) => ({
    bucket: range ? formatBucket(t.bucket, range.granularity) : t.bucket,
    revenue: t.revenue,
    orderCount: t.orderCount,
  }))

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Reportes</h2>
        <p className="mt-1 text-sm text-stone-500">
          Ventas reales (pedidos pagados) en el período seleccionado.
        </p>
      </section>

      {/* PRESET SELECTOR */}
      <section className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setPresetId(preset.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              presetId === preset.id
                ? "bg-stone-900 text-white shadow"
                : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPresetId("custom")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            presetId === "custom"
              ? "bg-stone-900 text-white shadow"
              : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
          }`}
        >
          Personalizado
        </button>
        {presetId === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
            <span className="text-stone-500">a</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        )}
      </section>

      {loading && (
        <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm font-semibold text-stone-500 animate-pulse">
          Cargando reporte...
        </p>
      )}

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && summary && (
        <>
          {/* KPI CARDS */}
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Total facturado</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-orange-600 tabular-nums">
                {formatCLP(summary.totalRevenue)}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Pedidos pagados</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-stone-900 tabular-nums">
                {summary.orderCount}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Promedio por pedido</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-stone-900 tabular-nums">
                {formatCLP(summary.averageTicket)}
              </p>
            </div>
          </section>

          {/* TIMELINE CHART */}
          <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
            <h3 className="text-lg font-bold text-stone-900">Distribución temporal</h3>
            <p className="mt-1 text-xs text-stone-500">
              {range?.granularity === "hour"
                ? "Por hora"
                : range?.granularity === "day"
                ? "Por día"
                : "Por mes"}
            </p>
            {chartData.length === 0 ? (
              <p className="mt-6 text-center text-sm text-stone-500">Sin datos en el período.</p>
            ) : (
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="#78716c" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#78716c" />
                    <Tooltip
                      formatter={(value, name) => {
                        const num = typeof value === "number" ? value : Number(value ?? 0)
                        return name === "revenue" ? formatCLP(num) : num
                      }}
                      labelStyle={{ color: "#1c1917", fontWeight: 700 }}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4" }}
                    />
                    <Bar dataKey="revenue" name="revenue" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* TOP PRODUCTS */}
          <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
            <h3 className="text-lg font-bold text-stone-900">Productos más vendidos</h3>
            {topProducts.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">Sin ventas en el período.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      <th className="pb-2 pr-4">Producto</th>
                      <th className="pb-2 pr-4 text-right">Unidades</th>
                      <th className="pb-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.slice(0, 20).map((p) => (
                      <tr
                        key={`${p.productName}-${p.variantName ?? ""}`}
                        className="border-b border-stone-50 last:border-b-0"
                      >
                        <td className="py-2.5 pr-4 font-semibold text-stone-900">
                          {p.productName}
                          {p.variantName && (
                            <span className="text-stone-400"> · {p.variantName}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-stone-700">{p.unitsSold}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-orange-600">
                          {formatCLP(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* SALES BY TABLE */}
          <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
            <h3 className="text-lg font-bold text-stone-900">Ventas por mesa</h3>
            {salesByTable.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">Sin ventas en el período.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      <th className="pb-2 pr-4">Mesa</th>
                      <th className="pb-2 pr-4 text-right">Pedidos</th>
                      <th className="pb-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesByTable.map((t) => (
                      <tr key={t.tableId} className="border-b border-stone-50 last:border-b-0">
                        <td className="py-2.5 pr-4 font-semibold text-stone-900">
                          Mesa {t.tableNumber ?? t.tableId}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-stone-700">{t.orderCount}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-orange-600">
                          {formatCLP(t.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
