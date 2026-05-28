"use client"

import { useMemo, useState } from "react"
import type { WaiterOrder } from "@/services/order-service"

const STATUS_NUEVO = 1
const STATUS_PREPARANDO = 2
const STATUS_LISTO = 3

type Props = {
  orders: WaiterOrder[]
  payingTableId: number | null
  onPayTable: (tableId: number) => Promise<{ ok: boolean; paidCount: number }>
  onSuccess?: (tableNumber: string, paidCount: number) => void
}

type TableSummary = {
  tableId: number
  tableLabel: string
  ordersCount: number
  total: number
  hasUnready: boolean
  unreadyCount: number
  unreadyStatuses: number[]
}

/**
 * Sección de "Cobrar mesa": para cada mesa del mesero con pedidos activos,
 * muestra una card con total + cantidad y un botón único que paga todos los
 * pedidos de la mesa en una sola operación.
 *
 * Si alguna orden no está en estado Listo, abre un modal de confirmación
 * advirtiendo cuáles aún están en cocina, para evitar cobrar por error
 * pedidos que no se sirvieron.
 */
export function PayTableSection({ orders, payingTableId, onPayTable, onSuccess }: Props) {
  const [confirmTable, setConfirmTable] = useState<TableSummary | null>(null)

  const summaries = useMemo<TableSummary[]>(() => {
    const map = new Map<number, TableSummary>()
    for (const o of orders) {
      if (o.tableId == null) continue
      if (o.statusId === 4) continue // ya pagado
      const label =
        o.tableNumber != null ? `Mesa ${o.tableNumber}` : `Mesa #${o.tableId}`
      const existing = map.get(o.tableId) ?? {
        tableId: o.tableId,
        tableLabel: label,
        ordersCount: 0,
        total: 0,
        hasUnready: false,
        unreadyCount: 0,
        unreadyStatuses: [] as number[],
      }
      existing.ordersCount += 1
      existing.total += o.total
      if (o.statusId !== STATUS_LISTO) {
        existing.hasUnready = true
        existing.unreadyCount += 1
        if (!existing.unreadyStatuses.includes(o.statusId)) {
          existing.unreadyStatuses.push(o.statusId)
        }
      }
      map.set(o.tableId, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.tableId - b.tableId)
  }, [orders])

  async function handleConfirmedPay(summary: TableSummary) {
    setConfirmTable(null)
    const result = await onPayTable(summary.tableId)
    if (result.ok) {
      onSuccess?.(summary.tableLabel, result.paidCount)
    }
  }

  async function handleClick(summary: TableSummary) {
    if (summary.hasUnready) {
      setConfirmTable(summary)
      return
    }
    await handleConfirmedPay(summary)
  }

  if (summaries.length === 0) return null

  return (
    <>
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold tracking-tight text-stone-900">Cobrar por mesa</h2>
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            {summaries.length} mesa{summaries.length === 1 ? "" : "s"} con pedidos
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((s) => {
            const isPaying = payingTableId === s.tableId
            const allReady = !s.hasUnready
            return (
              <article
                key={s.tableId}
                className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">{s.tableLabel}</h3>
                    <p className="text-[11px] text-stone-500">
                      {s.ordersCount} pedido{s.ordersCount === 1 ? "" : "s"} activo
                      {s.ordersCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      allReady
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-orange-50 text-orange-700 ring-1 ring-orange-200"
                    }`}
                  >
                    {allReady ? "Todos listos" : `${s.unreadyCount} en cocina`}
                  </span>
                </div>

                <p className="mt-3 text-2xl font-extrabold tracking-tight text-stone-950">
                  ${s.total.toLocaleString("es-CL")}
                </p>

                <button
                  type="button"
                  onClick={() => handleClick(s)}
                  disabled={isPaying || payingTableId != null}
                  className={`mt-3 w-full rounded-full px-4 py-2.5 text-xs font-bold text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    allReady
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {isPaying
                    ? "Cobrando…"
                    : allReady
                      ? `Cobrar ${s.tableLabel} (${s.ordersCount} pedido${s.ordersCount === 1 ? "" : "s"})`
                      : `Cobrar ${s.tableLabel} con advertencia`}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      {confirmTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
            <div className="border-b border-stone-100 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-stone-950">
                    Hay pedidos sin servir todavía
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    De los <strong>{confirmTable.ordersCount}</strong> pedidos de{" "}
                    {confirmTable.tableLabel},{" "}
                    <strong>{confirmTable.unreadyCount}</strong>{" "}
                    {confirmTable.unreadyCount === 1 ? "sigue" : "siguen"} en{" "}
                    {confirmTable.unreadyStatuses.includes(STATUS_NUEVO) &&
                    confirmTable.unreadyStatuses.includes(STATUS_PREPARANDO)
                      ? "Nuevo o Preparando"
                      : confirmTable.unreadyStatuses.includes(STATUS_NUEVO)
                        ? "estado Nuevo"
                        : "Preparación"}
                    . Si cobrás ahora, esos pedidos quedarán pagados pero podrían
                    no haberse servido.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 bg-stone-50">
              <button
                type="button"
                onClick={() => setConfirmTable(null)}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmedPay(confirmTable)}
                disabled={payingTableId != null}
                className="rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow hover:bg-orange-600 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cobrar igual
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
