"use client"

import React, { Suspense, useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  getStaffRoleLabel,
  getStaffTimeoutSetting,
  isAdminRole,
} from "@/lib/waiter-session"
import { useStaffProfile } from "@/hooks/useStaffProfile"
import { useWaiterOrders } from "@/hooks/useWaiterOrders"
import { useRestaurantTables } from "@/hooks/useRestaurantTables"
import { supabase } from "@/lib/supabase"
import type { WaiterOrder } from "@/services/order-service"

const STATUS_NUEVO = 1
const STATUS_PREPARANDO = 2
const STATUS_LISTO = 3

const STATUS_LABEL: Record<number, string> = {
  [STATUS_NUEVO]: "Nuevo",
  [STATUS_PREPARANDO]: "Preparando",
  [STATUS_LISTO]: "Listo",
}

const STATUS_STYLE: Record<number, { dot: string; bg: string; glow: string }> = {
  [STATUS_NUEVO]: {
    dot: "bg-orange-500 shadow-orange-500/50",
    bg: "bg-orange-50 text-orange-700 border-orange-200/50",
    glow: "rgba(249, 115, 22, 0.2)",
  },
  [STATUS_PREPARANDO]: {
    dot: "bg-stone-800 shadow-stone-800/40",
    bg: "bg-stone-50 text-stone-700 border-stone-200",
    glow: "rgba(28, 25, 23, 0.1)",
  },
  [STATUS_LISTO]: {
    dot: "bg-emerald-500 shadow-emerald-500/50",
    bg: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
    glow: "rgba(16, 185, 129, 0.25)",
  },
}

function parseDbTimestamp(iso: string | null): number | null {
  if (!iso) return null
  // La columna en DB puede ser `timestamp without time zone` y Postgres la guarda
  // en UTC. Si el string viene sin "Z" ni offset, JS lo parsea como hora local
  // del navegador. Forzamos UTC añadiendo "Z" cuando falta.
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`
  const ms = new Date(normalized).getTime()
  return Number.isNaN(ms) ? null : ms
}

function minutesSince(iso: string | null): number {
  const ms = parseDbTimestamp(iso)
  if (ms == null) return 0
  return Math.max(0, Math.floor((Date.now() - ms) / 60000))
}

function elapsedMinutes(order: { createdAt: string | null; readyAt: string | null }): number {
  const start = parseDbTimestamp(order.createdAt)
  if (start == null) return 0
  const endIso = order.readyAt
  const end = endIso ? parseDbTimestamp(endIso) ?? Date.now() : Date.now()
  return Math.max(0, Math.floor((end - start) / 60000))
}

function tableLabel(o: WaiterOrder): string {
  if (o.tableNumber != null) return `Mesa ${o.tableNumber}`
  if (o.tableId != null) return `Mesa #${o.tableId}`
  return "Sin mesa"
}

export default function WaiterControlPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FAF9F5] px-6 text-sm font-semibold text-stone-600">
          Cargando...
        </main>
      }
    >
      <WaiterControlSystem />
    </Suspense>
  )
}

function WaiterControlSystem() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const focusTableId = (() => {
    const raw = searchParams.get("tableId")
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  })()
  const focusTableNumber = searchParams.get("tableNumber") || null
  const { profile: loggedInStaff, loading: profileLoading } = useStaffProfile()

  const restaurantId = loggedInStaff?.restaurantId ?? null
  const staffId = loggedInStaff?.id ?? null
  const { orders, loading: ordersLoading, error: ordersError, advance, markPaid, advancingId } =
    useWaiterOrders(restaurantId)
  const { tables: allTables } = useRestaurantTables(restaurantId)

  // Derivamos del listado global: mías, libres y ocupadas por otros.
  const assignedTables = useMemo(
    () => allTables.filter((t) => staffId != null && t.currentWaiterId === staffId),
    [allTables, staffId]
  )
  const availableTables = useMemo(
    () => allTables.filter((t) => t.currentWaiterId == null),
    [allTables]
  )
  const occupiedByOthers = useMemo(
    () =>
      allTables.filter(
        (t) => t.currentWaiterId != null && t.currentWaiterId !== staffId
      ),
    [allTables, staffId]
  )

  const assignedTableIds = useMemo(
    () => new Set(assignedTables.map((t) => t.id)),
    [assignedTables]
  )

  const [selectedOrder, setSelectedOrder] = useState<WaiterOrder | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | 1 | 2 | 3>("all")
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [sessionTimeoutSetting, setSessionTimeoutSetting] = useState(0)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)

  // Tick para refrescar los "minutos transcurridos" cada 30s
  const [, setNowTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const timeout = getStaffTimeoutSetting()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage al montar.
    setSessionTimeoutSetting(timeout)
    setSecondsRemaining(timeout)
  }, [])

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.replace("/waiter/login")
  }, [router])

  useEffect(() => {
    if (profileLoading) return
    if (!loggedInStaff) {
      router.replace("/waiter/login")
      return
    }
    // Acceso cruzado: si un admin entra a esta URL, lo mandamos al login de
    // mesero sin cerrar su sesión. Si decide loguearse como mesero, ese signIn
    // reemplaza su sesión; si vuelve a /admin sigue logueado como admin.
    if (isAdminRole(loggedInStaff.role)) {
      router.replace("/waiter/login")
    }
  }, [profileLoading, loggedInStaff, router])

  // Reacciona si la sesión cambia desde otra pestaña (login/logout en otro lado).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/waiter/login")
      }
    )
    return () => subscription.unsubscribe()
  }, [router])

  // Inactivity timer
  useEffect(() => {
    if (!loggedInStaff || !sessionTimeoutSetting) return

    const mainTimer = setInterval(() => {
      // No descontar mientras la pestaña esté oculta: cambiar de tab no debe
      // contar como inactividad real del usuario.
      if (typeof document !== "undefined" && document.hidden) return

      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(mainTimer)
          handleLogout()
          return 0
        }
        if (prev <= 16) setShowTimeoutWarning(true)
        else setShowTimeoutWarning(false)
        return prev - 1
      })
    }, 1000)

    const resetTimer = () => {
      setSecondsRemaining(sessionTimeoutSetting)
      setShowTimeoutWarning(false)
    }

    const handleVisibility = () => {
      if (!document.hidden) resetTimer()
    }

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "click"]
    events.forEach((ev) => window.addEventListener(ev, resetTimer))
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", resetTimer)

    return () => {
      clearInterval(mainTimer)
      events.forEach((ev) => window.removeEventListener(ev, resetTimer))
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", resetTimer)
    }
  }, [loggedInStaff, sessionTimeoutSetting, handleLogout])

  const handleAdvance = useCallback(
    async (order: WaiterOrder) => {
      const ok = await advance(order.id)
      if (!ok) return
      const next = order.statusId + 1
      if (next === STATUS_PREPARANDO)
        triggerToast(`Pedido #${order.id} en preparación 🍳`)
      else if (next === STATUS_LISTO)
        triggerToast(`¡Pedido #${order.id} listo para servir! 🛎️`)
    },
    [advance, triggerToast]
  )

  const handleMarkPaid = useCallback(
    async (order: WaiterOrder) => {
      const ok = await markPaid(order.id)
      if (!ok) return
      triggerToast(`Pedido #${order.id} pagado 💸`)
    },
    [markPaid, triggerToast]
  )

  // Mesero solo ve pedidos de mesas que tiene asignadas ahora mismo.
  // Si además escaneó una mesa específica (focusTableId), filtra a esa.
  const ownOrders = useMemo(
    () => orders.filter((o) => o.tableId != null && assignedTableIds.has(o.tableId)),
    [orders, assignedTableIds]
  )

  const filteredOrders = useMemo(
    () =>
      ownOrders.filter((o) => {
        if (focusTableId != null && o.tableId !== focusTableId) return false
        return activeTab === "all" || o.statusId === activeTab
      }),
    [ownOrders, activeTab, focusTableId]
  )

  const liveOrdersCount = ownOrders.length
  const avgWaitTime = useMemo(() => {
    // Promedio sobre todas las órdenes vivas (Nuevo/Preparando = tiempo en vivo,
    // Listo = tiempo congelado en ready_at). Así no cae a 0 cuando todas pasan
    // a Listo y queda como referencia del tiempo medio de atencion.
    if (!ownOrders.length) return 0
    const total = ownOrders.reduce((acc, o) => acc + elapsedMinutes(o), 0)
    return Math.round(total / ownOrders.length)
  }, [ownOrders])

  if (profileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F5] px-6 text-sm font-semibold text-stone-600">
        Cargando...
      </main>
    )
  }

  if (!loggedInStaff) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F5] px-6 text-sm font-semibold text-stone-600">
        Redirigiendo al login de mesero...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAF9F5] font-sans text-stone-900 selection:bg-orange-100 selection:text-orange-900 pb-20">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-card-entrance rounded-2xl border border-stone-200/80 bg-white/95 px-5 py-4 shadow-2xl shadow-stone-900/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
          <p className="text-sm font-semibold text-stone-800">{toastMessage}</p>
        </div>
      )}

      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-orange-100/40 blur-3xl" />
      <div className="absolute top-1/3 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-orange-50/20 blur-3xl" />

      <header className="mx-auto max-w-7xl px-6 py-6 border-b border-stone-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex h-9 items-center gap-2 rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-600 transition hover:border-stone-400 hover:bg-white">
              <svg className="h-4 w-4 transition group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Volver a MESA
            </Link>
            <div className="h-4 w-[1px] bg-stone-300" />
            <div>
              <span className="text-[10px] font-bold tracking-widest text-orange-600 uppercase">Sistema de Control Operativo</span>
              <h1 className="text-xl font-bold tracking-tight text-stone-950">Pedidos en vivo</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/95 px-3 py-1.5 shadow-sm text-xs font-semibold text-stone-700 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
              <div className={`h-5 w-5 rounded-full bg-gradient-to-tr ${loggedInStaff.avatar_color} flex items-center justify-center text-white text-[8px] font-bold`}>
                {loggedInStaff.name.substring(0, 2).toUpperCase()}
              </div>
              <span>
                <strong className="text-stone-900">{loggedInStaff.name}</strong>
                <span className="text-stone-400 font-normal"> ({getStaffRoleLabel(loggedInStaff.role)})</span>
              </span>
              <div className="h-3.5 w-[1px] bg-stone-200 mx-1" />
              <button
                onClick={handleLogout}
                className="text-stone-500 hover:text-stone-700 font-medium transition cursor-pointer"
                title="Cerrar sesión"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 mt-8">
        {ordersError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {ordersError}
          </div>
        )}

        {focusTableId != null && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-orange-200/70 bg-orange-50/80 px-4 py-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white text-sm font-bold">
              {focusTableNumber || `#${focusTableId}`}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-orange-700">
                Mesa escaneada
              </p>
              <p className="text-sm font-semibold text-stone-800">
                Mostrando solo pedidos de{" "}
                {focusTableNumber ? `Mesa ${focusTableNumber}` : `Mesa #${focusTableId}`}
              </p>
            </div>
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-bold tracking-tight text-stone-900">Mesas del restaurante</h2>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              {assignedTables.length} tuya{assignedTables.length === 1 ? "" : "s"} · {availableTables.length} libre{availableTables.length === 1 ? "" : "s"} · {occupiedByOthers.length} ocupada{occupiedByOthers.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                Disponibles ({availableTables.length})
              </p>
              {availableTables.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No hay mesas libres ahora.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTables.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Mesa {t.tableNumber ?? `#${t.id}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                No disponibles ({assignedTables.length + occupiedByOthers.length})
              </p>
              {assignedTables.length + occupiedByOthers.length === 0 ? (
                <p className="text-xs text-stone-400 italic">Todas las mesas están libres.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedTables.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/70 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800"
                      title="Atendida por ti"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      Mesa {t.tableNumber ?? `#${t.id}`} · tú
                    </span>
                  ))}
                  {occupiedByOthers.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600"
                      title="Atendida por otro mesero"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-400" />
                      Mesa {t.tableNumber ?? `#${t.id}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Pedidos activos</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold tracking-tight text-stone-950">{liveOrdersCount}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700">En curso</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">Nuevos, en preparación o listos</p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Tiempo promedio</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold tracking-tight text-stone-950">
                {avgWaitTime} <span className="text-lg font-medium">min</span>
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-2">Desde que entró la orden</p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Listos para servir</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold tracking-tight text-stone-950">
                {ownOrders.filter((o) => o.statusId === STATUS_LISTO).length}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Listo</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">Lleva estos a la mesa</p>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="text-xs font-bold tracking-widest text-stone-400 uppercase">Monitoreo</span>
              <h2 className="text-lg font-bold tracking-tight text-stone-950 mt-0.5">Tablero de pedidos</h2>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200/50">
              {([
                ["all", "Todos"],
                [STATUS_NUEVO, "Nuevos"],
                [STATUS_PREPARANDO, "Preparando"],
                [STATUS_LISTO, "Listos"],
              ] as const).map(([tab, label]) => (
                <button
                  key={String(tab)}
                  onClick={() => setActiveTab(tab as "all" | 1 | 2 | 3)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === tab
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {ordersLoading && ownOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center text-sm font-medium text-stone-500">
              Cargando órdenes...
            </div>
          ) : assignedTables.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 py-16 px-6 text-center">
              <p className="text-sm font-semibold text-stone-700">
                No tienes mesas asignadas
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Escanea el QR de una mesa para empezar a atenderla.
              </p>
            </div>
          ) : ownOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center text-sm font-medium text-stone-500">
              Sin pedidos en tus mesas por ahora.
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
              {[STATUS_NUEVO, STATUS_PREPARANDO, STATUS_LISTO].map((status) => {
                const col = filteredOrders.filter((o) => o.statusId === status)
                return (
                  <div key={status} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[status].dot}`} />
                        <h3 className="text-sm font-bold tracking-tight text-stone-900 uppercase">
                          {STATUS_LABEL[status]}
                        </h3>
                      </div>
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
                        {col.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3 min-h-[200px]">
                      {col.map((ord) => (
                        <OrderCard
                          key={ord.id}
                          order={ord}
                          config={STATUS_STYLE[ord.statusId]}
                          onAdvance={handleAdvance}
                          onMarkPaid={handleMarkPaid}
                          onSelect={setSelectedOrder}
                          advancing={advancingId === ord.id}
                        />
                      ))}
                      {col.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 px-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 text-center">
                          <p className="text-xs text-stone-400 font-medium">Sin pedidos</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-stone-200/80 bg-[#FAF9F5] p-6 shadow-2xl animate-card-entrance">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Detalles del pedido</span>
                <h2 className="text-xl font-bold tracking-tight text-stone-950 mt-1">
                  Pedido #{selectedOrder.id} • {tableLabel(selectedOrder)}
                </h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLE[selectedOrder.statusId].bg}`}>
                <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[selectedOrder.statusId].dot}`} />
                {STATUS_LABEL[selectedOrder.statusId]}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-stone-200/60 bg-white p-4">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Artículos</p>
              {selectedOrder.items.length === 0 ? (
                <p className="text-xs text-stone-500 py-2">Sin items registrados.</p>
              ) : (
                <ul className="divide-y divide-stone-100 text-sm text-stone-700">
                  {selectedOrder.items.map((item) => (
                    <li key={item.id} className="py-2.5 flex justify-between font-semibold">
                      <span>
                        {item.productQuantity}x {item.productName}
                        {item.notes && (
                          <span className="block text-[10px] text-orange-600 italic font-normal mt-0.5">
                            📝 {item.notes}
                          </span>
                        )}
                      </span>
                      <span className="text-stone-500 font-medium">
                        ${(item.productPrice * item.productQuantity).toLocaleString("es-CL")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-4 border-t border-stone-100 flex justify-between items-baseline">
                <span className="text-xs text-stone-500 font-medium">Total:</span>
                <span className="text-lg font-extrabold text-stone-950">
                  ${selectedOrder.total.toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-between text-xs text-stone-500 bg-stone-100/80 rounded-xl p-3 border border-stone-200/40">
              <div>
                <span className="font-bold uppercase text-[9px] text-stone-400">Tiempo</span>
                <p className="font-semibold text-stone-700 mt-0.5">
                  {selectedOrder.statusId >= STATUS_LISTO
                    ? "—"
                    : `${minutesSince(selectedOrder.createdAt)} min`}
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold uppercase text-[9px] text-stone-400">Mesa</span>
                <p className="font-semibold text-stone-700 mt-0.5">{tableLabel(selectedOrder)}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200/60 pt-4">
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-600 hover:border-stone-400 transition cursor-pointer"
              >
                Cerrar
              </button>

              {selectedOrder.statusId < STATUS_LISTO && (
                <button
                  onClick={async () => {
                    const order = selectedOrder
                    setSelectedOrder(null)
                    await handleAdvance(order)
                  }}
                  disabled={advancingId === selectedOrder.id}
                  className="rounded-full bg-stone-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
                >
                  {selectedOrder.statusId === STATUS_NUEVO
                    ? "Iniciar preparación 🍳"
                    : "Marcar listo 🛎️"}
                </button>
              )}
              {selectedOrder.statusId === STATUS_LISTO && (
                <button
                  onClick={async () => {
                    const order = selectedOrder
                    setSelectedOrder(null)
                    await handleMarkPaid(order)
                  }}
                  disabled={advancingId === selectedOrder.id}
                  className="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                >
                  Marcar pagado 💸
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showTimeoutWarning && loggedInStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-red-100 bg-[#FAF9F5] p-6 shadow-2xl text-center animate-card-entrance">
            <div className="mx-auto h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold animate-bounce mb-4">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-stone-900">¿Sigues ahí, {loggedInStaff.name}?</h3>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed">
              Por seguridad, tu sesión se cerrará automáticamente en:
            </p>
            <div className="my-5 text-4xl font-extrabold text-orange-600 tracking-tight">
              {secondsRemaining}s
            </div>
            <button
              onClick={() => {
                setSecondsRemaining(sessionTimeoutSetting)
                setShowTimeoutWarning(false)
              }}
              className="w-full rounded-full bg-stone-950 py-3 text-xs font-bold text-white hover:bg-stone-800 transition cursor-pointer"
            >
              Mantener sesión activa
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function OrderCard({
  order,
  config,
  onAdvance,
  onMarkPaid,
  onSelect,
  advancing,
}: {
  order: WaiterOrder
  config: { dot: string; bg: string; glow: string }
  onAdvance: (order: WaiterOrder) => void
  onMarkPaid: (order: WaiterOrder) => void
  onSelect: (ord: WaiterOrder) => void
  advancing: boolean
}) {
  const mins = minutesSince(order.createdAt)
  const isReady = order.statusId === STATUS_LISTO
  const isTerminal = order.statusId >= STATUS_LISTO

  return (
    <div
      onClick={() => onSelect(order)}
      className="rounded-2xl border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer hover:border-orange-300"
      style={{
        boxShadow: `0 4px 20px -2px ${config.glow}, 0 2px 4px -1px rgba(0, 0, 0, 0.04)`,
      } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold text-stone-400 uppercase">Orden #{order.id}</span>
          <h4 className="text-sm font-bold text-stone-900 mt-0.5">{tableLabel(order)}</h4>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${config.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          {STATUS_LABEL[order.statusId]}
        </span>
      </div>

      {order.items.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-600">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between font-medium">
              <span className="truncate pr-2">
                {item.productQuantity}x {item.productName}
              </span>
              <span className="text-stone-400 shrink-0">
                ${(item.productPrice * item.productQuantity).toLocaleString("es-CL")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-400 italic">Sin items</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
        <div>
          <p className="text-[9px] text-stone-400 font-bold uppercase">Tiempo</p>
          <p className="text-xs font-semibold text-stone-700">
            {isTerminal ? "—" : `${mins} min`}
          </p>
        </div>

        {!isTerminal ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAdvance(order)
            }}
            disabled={advancing}
            className="flex items-center gap-1 rounded-full bg-stone-950 px-3 py-1.5 text-[10px] font-semibold text-white shadow transition hover:bg-stone-800 cursor-pointer disabled:opacity-50"
          >
            <span>{advancing ? "..." : "Siguiente"}</span>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ) : isReady ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMarkPaid(order)
            }}
            disabled={advancing}
            className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-semibold text-white shadow transition hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
          >
            <span>{advancing ? "..." : "Marcar pagado 💸"}</span>
          </button>
        ) : (
          <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Pagado
          </span>
        )}
      </div>
    </div>
  )
}
