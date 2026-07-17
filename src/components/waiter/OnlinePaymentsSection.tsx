"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { listOnlinePayments, type OnlinePayment } from "@/services/online-payments-service"
import { PAYMENT_PROVIDER_LABEL } from "@/lib/payments/types"

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})
const fmt = (n: number) => clp.format(Math.round(n || 0))

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pagado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  pending: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  authorized: { label: "Procesando", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  failed: { label: "Rechazado", cls: "bg-red-50 text-red-600 ring-red-200" },
  refunded: { label: "Reembolsado", cls: "bg-stone-100 text-stone-600 ring-stone-200" },
}

function hora(iso: string): string {
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
}

export function OnlinePaymentsSection() {
  const [payments, setPayments] = useState<OnlinePayment[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await listOnlinePayments()
    if (res.ok) setPayments(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = window.setInterval(load, 30_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  // El total cobrado en línea (pagado) es dinero que NO entra a caja: va a la
  // cuenta de la pasarela del restaurante.
  const totalPagado = useMemo(
    () => payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount + p.tip, 0),
    [payments]
  )
  const countPagado = useMemo(() => payments.filter((p) => p.status === "paid").length, [payments])

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-stone-900">Pagos en línea de hoy</h2>
          <p className="mt-1 text-sm text-stone-500">
            Cobros por pasarela. Este dinero llega a la cuenta bancaria del restaurante, no a la caja.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Cobrado hoy</p>
          <p className="text-2xl font-extrabold leading-none tracking-tight text-emerald-600 tabular-nums">
            {fmt(totalPagado)}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-400">
            {countPagado} {countPagado === 1 ? "pago" : "pagos"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 animate-pulse rounded-xl bg-stone-100" />
            <div className="h-10 animate-pulse rounded-xl bg-stone-100" />
          </div>
        ) : payments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
            Todavía no hay pagos en línea hoy.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-2 pr-3">Hora</th>
                  <th className="py-2 pr-3">Mesa</th>
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Propina</th>
                  <th className="py-2 pr-3">Vía</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {payments.map((p) => {
                  const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
                  return (
                    <tr key={p.id} className="text-stone-800">
                      <td className="py-2.5 pr-3 tabular-nums text-stone-500">{hora(p.createdAt)}</td>
                      <td className="py-2.5 pr-3 font-semibold">{p.tableNumber ?? "—"}</td>
                      <td className="py-2.5 pr-3 font-bold tabular-nums">{fmt(p.amount)}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-stone-500">
                        {p.tip > 0 ? fmt(p.tip) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-stone-500">
                        {PAYMENT_PROVIDER_LABEL[p.provider ?? ""] ?? p.provider ?? "—"}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${st.cls}`}
                        >
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
