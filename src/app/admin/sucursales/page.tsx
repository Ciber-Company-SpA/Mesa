"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

type Branch = {
  restaurant_id: number
  restaurant_name: string
  orders_total: number
  revenue_total: number
  tables_count: number
  is_current: boolean
}

export default function SucursalesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.rpc("get_my_organization_branches").then(({ data }) => {
      if (!active) return
      setBranches((data ?? []) as Branch[])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const totalBranches = branches.length
  const totalTables = branches.reduce((acc, b) => acc + (b.tables_count ?? 0), 0)
  const totalOrders = branches.reduce((acc, b) => acc + (b.orders_total ?? 0), 0)
  const totalRevenue = branches.reduce((acc, b) => acc + (b.revenue_total ?? 0), 0)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Sucursales</h2>
        <p className="mt-1 text-sm text-stone-500">
          Vista consolidada de las sucursales de tu grupo.
        </p>
      </section>

      {loading && (
        <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm font-semibold text-stone-500 animate-pulse">
          Cargando sucursales...
        </p>
      )}

      {!loading && branches.length === 0 && (
        <section className="rounded-3xl bg-white p-10 text-center ring-1 ring-stone-200 shadow-sm">
          <p className="text-sm font-semibold text-stone-600">
            Tu restaurante no pertenece a un grupo multi-sucursal.
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Esta vista es para cadenas (plan Personalizado).
          </p>
        </section>
      )}

      {!loading && branches.length > 0 && (
        <>
          {/* KPIs CONSOLIDADOS */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Sucursales</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-stone-900 tabular-nums">
                {totalBranches}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Mesas</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-stone-900 tabular-nums">
                {totalTables}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Pedidos</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-stone-900 tabular-nums">
                {totalOrders}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Ventas</p>
              <p className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-orange-600 tabular-nums">
                {clp.format(totalRevenue)}
              </p>
            </div>
          </section>

          {/* TABLA DE SUCURSALES */}
          <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
            <h3 className="text-lg font-bold text-stone-900">Detalle por sucursal</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="pb-2 pr-4">Sucursal</th>
                    <th className="pb-2 pr-4 text-right">Mesas</th>
                    <th className="pb-2 pr-4 text-right">Pedidos</th>
                    <th className="pb-2 text-right">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr
                      key={b.restaurant_id}
                      className="border-b border-stone-50 last:border-b-0"
                    >
                      <td className="py-2.5 pr-4 font-semibold text-stone-900">
                        <span className="inline-flex items-center gap-2">
                          {b.restaurant_name}
                          {b.is_current && (
                            <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 ring-1 ring-orange-200">
                              Actual
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-stone-700">
                        {b.tables_count}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-stone-700">
                        {b.orders_total}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-orange-600">
                        {clp.format(b.revenue_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
