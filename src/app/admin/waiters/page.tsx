"use client"

import { useState } from "react"

import { INITIAL_WAITERS, type Waiter } from "@/lib/mock-waiters"

export default function WaitersPage() {
  const [waiters, setWaiters] = useState<Waiter[]>(INITIAL_WAITERS)
  const [filter, setFilter] = useState<string>("todos")
  const [search, setSearch] = useState<string>("")

  const toggleStatus = (id: number) => {
    setWaiters((prev) =>
      prev.map((waiter) => {
        if (waiter.id !== id) return waiter
        let nextStatus: "Disponible" | "Ocupado" | "Descanso" = "Disponible"
        let nextDetail = "Zona Terraza - Disponible"
        let nextTables = waiter.tables

        if (waiter.status === "Disponible") {
          nextStatus = "Ocupado"
          nextDetail = "Servicio activo"
        } else if (waiter.status === "Ocupado") {
          nextStatus = "Descanso"
          nextDetail = "En descanso (15 min)"
          nextTables = []
        } else {
          nextStatus = "Disponible"
          nextDetail = "Disponible"
          nextTables = ["Mesa 1", "Mesa 2"]
        }

        return {
          ...waiter,
          status: nextStatus,
          statusDetail: nextDetail,
          tables: nextTables,
        }
      })
    )
  }

  const filteredWaiters = waiters.filter((waiter) => {
    const matchesSearch = waiter.name.toLowerCase().includes(search.toLowerCase()) || waiter.role.toLowerCase().includes(search.toLowerCase())
    if (filter === "todos") return matchesSearch
    if (filter === "disponible") return waiter.status === "Disponible" && matchesSearch
    if (filter === "ocupado") return waiter.status === "Ocupado" && matchesSearch
    if (filter === "descanso") return waiter.status === "Descanso" && matchesSearch
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Encabezado local minimalista adaptado al layout */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Meseros y Personal</h2>
          <p className="text-sm text-stone-600">
            Control de asistencia, mesas auto-asignadas por el personal y desempeno en sala.
          </p>
        </div>

        <button
          onClick={() => {
            const name = prompt("Nombre del mesero:")
            if (!name) return
            const role = prompt("Rol (ej. Mesero, Bartender, Caja):", "Mesero") || "Mesero"
            const newWaiter: Waiter = {
              id: Date.now(),
              name,
              initials: name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
              role,
              status: "Disponible",
              statusDetail: "Ingreso al turno justo ahora",
              tables: [],
              rating: "5.0",
              efficiency: "100%",
              color: "bg-emerald-500 text-white",
            }
            setWaiters(prev => [...prev, newWaiter])
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-500/35"
        >
          <span>+ Agregar Mesero</span>
        </button>
      </div>

      {/* Metricas rapidas */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">En Turno</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            {waiters.length} meseros
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">Mesas Atendidas</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-orange-700">
            {waiters.reduce((acc, curr) => acc + curr.tables.length, 0)} mesas
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-500">Calificacion Promedio</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
            4.8 / 5.0
          </p>
        </div>
      </div>

      {/* Filtros e inputs */}
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {["todos", "disponible", "ocupado", "descanso"].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                filter === item
                  ? "bg-stone-950 text-white"
                  : "bg-stone-50 text-stone-600 hover:bg-stone-100"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-3 flex items-center text-stone-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre o rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-4 text-xs font-medium text-stone-700 outline-none ring-offset-1 focus:border-stone-400 focus:bg-white focus:ring-1 focus:ring-stone-400"
          />
        </div>
      </div>

      {/* Listado principal */}
      <section className="grid gap-4 sm:grid-cols-2">
        {filteredWaiters.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
            <p className="text-sm font-semibold text-stone-600">No se encontraron meseros en esta categoria.</p>
          </div>
        ) : (
          filteredWaiters.map((waiter) => (
            <article
              key={waiter.id}
              className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold shadow-sm ${waiter.color}`}>
                  {waiter.initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-stone-900">{waiter.name}</h3>
                  </div>
                  <p className="text-xs text-stone-500">{waiter.role}</p>
                </div>
              </div>

              {/* Mesas y metricas de desempeno */}
              <div className="mt-4 border-t border-stone-100 pt-4">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Atendiendo mesas:</p>
                <div className="mb-3 flex flex-wrap gap-1">
                  {waiter.tables.length > 0 ? (
                    waiter.tables.map((table) => (
                      <span
                        key={table}
                        className="rounded-lg bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-200/50"
                      >
                        {table}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] font-medium text-stone-400 italic">
                      Sin mesas asignadas
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-stone-500">
                  <div className="flex items-center gap-1">
                    <span>Calificacion:</span>
                    <span className="text-stone-800">{waiter.rating}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Eficiencia:</span>
                    <span className="text-stone-800">{waiter.efficiency}</span>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <p className="text-center text-[10px] font-medium text-stone-450 italic">
        * Nota: Los meseros auto-asignan sus mesas en tiempo real escaneando el codigo QR desde su propia terminal.
      </p>
    </div>
  )
}
