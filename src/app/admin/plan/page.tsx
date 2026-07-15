"use client"

import { useMyPlan } from "@/hooks/useMyPlan"

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

type StatusMeta = {
  label: string
  className: string
}

const STATUS_META: Record<string, StatusMeta> = {
  trial: { label: "Prueba", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  active: { label: "Activo", className: "bg-green-50 text-green-700 ring-green-200" },
  past_due: { label: "Moroso", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  suspended: { label: "Suspendido", className: "bg-red-50 text-red-700 ring-red-200" },
  cancelled: { label: "Dado de baja", className: "bg-stone-100 text-stone-600 ring-stone-300" },
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })
}

export default function PlanPage() {
  const { plan, loading } = useMyPlan()

  if (loading) {
    return (
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Mi plan</h2>
          <p className="mt-1 text-sm text-stone-500">Detalle de tu plan y estado de la cuenta.</p>
        </section>
        <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm font-semibold text-stone-500 animate-pulse">
          Cargando plan...
        </p>
      </div>
    )
  }

  const status = plan?.account_status ?? ""
  const statusMeta = STATUS_META[status] ?? {
    label: status || "Desconocido",
    className: "bg-stone-100 text-stone-600 ring-stone-300",
  }

  const maxTables = plan?.max_tables ?? null
  const tablesCount = plan?.tables_count ?? 0
  const unlimited = maxTables === null
  const overLimit = maxTables !== null && tablesCount > maxTables
  const usagePct =
    maxTables && maxTables > 0 ? Math.min(100, Math.round((tablesCount / maxTables) * 100)) : 0

  const hasPrices =
    (plan?.one_time_price ?? null) !== null || (plan?.support_monthly_price ?? null) !== null

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Mi plan</h2>
        <p className="mt-1 text-sm text-stone-500">Detalle de tu plan y estado de la cuenta.</p>
      </section>

      {/* PLAN + ESTADO */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Plan actual</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-stone-900">
              {plan?.plan_name ?? "Sin plan asignado"}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusMeta.className}`}
          >
            {statusMeta.label}
          </span>
        </div>

        {status === "trial" && plan?.trial_ends_at && (
          <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 ring-1 ring-blue-200">
            Tu prueba vence el {formatDate(plan.trial_ends_at)}.
          </p>
        )}
      </section>

      {/* USO DE MESAS */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-bold text-stone-900">Uso de mesas</h3>
          {overLimit && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
              Límite superado
            </span>
          )}
        </div>
        <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight tabular-nums text-stone-900">
          {tablesCount}
          <span className="text-lg font-bold text-stone-400">
            {" "}
            / {unlimited ? "ilimitado" : maxTables}
          </span>
        </p>
        {!unlimited && (
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full ${overLimit ? "bg-red-500" : "bg-orange-500"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        )}
      </section>

      {/* PRECIOS */}
      {hasPrices && (
        <section className="grid gap-3 sm:grid-cols-2">
          {(plan?.one_time_price ?? null) !== null && (
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Pago único</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-orange-600 tabular-nums">
                {clp.format(plan!.one_time_price!)}
              </p>
            </div>
          )}
          {(plan?.support_monthly_price ?? null) !== null && (
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Soporte mensual
              </p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-stone-900 tabular-nums">
                {clp.format(plan!.support_monthly_price!)}
              </p>
            </div>
          )}
        </section>
      )}

      {/* AVISO VENTAS */}
      <section className="rounded-3xl bg-stone-50 p-6 ring-1 ring-stone-200">
        <p className="text-sm font-medium text-stone-600">
          El plan se contrata como servicio; para cambiar de plan, habla con ventas.
        </p>
        <a
          href="mailto:administracion@cyber-company.cl"
          className="mt-4 inline-flex items-center rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-600"
        >
          Hablar con ventas
        </a>
      </section>
    </div>
  )
}
