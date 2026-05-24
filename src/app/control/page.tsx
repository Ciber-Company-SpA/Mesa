"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"

// Types for the dashboard
interface OrderItem {
  name: string
  quantity: number
  price: number // unit price of the product
}

interface Order {
  id: number
  table: string
  items: OrderItem[]
  minutes: number
  status: "Nuevo" | "Preparando" | "Listo" | "Entregado"
  price: number // total calculated price
  notes?: string
}

interface Table {
  id: string
  number: string
  status: "Listo" | "Preparando" | "Esperando" | "Pagando" | "Libre"
  orderId?: number
  capacity: number
}

// Initial Simulated Data
const INITIAL_ORDERS: Order[] = [
  {
    id: 101,
    table: "Mesa 04",
    items: [
      { name: "Burger MESA Premium", quantity: 2, price: 11990 },
      { name: "Papas Trufadas", quantity: 1, price: 6990 },
      { name: "Jugo Natural Orgánico", quantity: 2, price: 3490 }
    ],
    minutes: 4,
    status: "Nuevo",
    price: 37950, // (11990*2) + 6990 + (3490*2) = 23980 + 6990 + 6980 = 37950
    notes: "Sin cebolla en una de las burgers.",
  },
  {
    id: 102,
    table: "Mesa 02",
    items: [
      { name: "Fettuccine Alfredo", quantity: 1, price: 12990 },
      { name: "Copa de Chardonnay Reserva", quantity: 1, price: 5990 }
    ],
    minutes: 12,
    status: "Preparando",
    price: 18980,
    notes: "Pasta al dente por favor.",
  },
  {
    id: 103,
    table: "Mesa 07",
    items: [
      { name: "Pizza Diábola Familiar", quantity: 1, price: 15990 },
      { name: "Aperol Spritz", quantity: 1, price: 6990 }
    ],
    minutes: 21,
    status: "Listo",
    price: 22980,
  },
  {
    id: 104,
    table: "Mesa 01",
    items: [
      { name: "Ramen Tonkotsu Ahumado", quantity: 2, price: 13990 },
      { name: "Tacos de Entraña (3 pzs)", quantity: 1, price: 9990 },
      { name: "Espresso Doble", quantity: 1, price: 2990 }
    ],
    minutes: 32,
    status: "Entregado",
    price: 40960,
  },
  {
    id: 105,
    table: "Mesa 03",
    items: [
      { name: "Ensalada César con Pollo", quantity: 1, price: 10990 },
      { name: "Jugo Natural", quantity: 1, price: 3490 }
    ],
    minutes: 8,
    status: "Nuevo",
    price: 14480,
  },
  {
    id: 106,
    table: "Mesa 06",
    items: [
      { name: "Torta de Tres Leches", quantity: 1, price: 5990 },
      { name: "Espresso Doble", quantity: 2, price: 2990 }
    ],
    minutes: 15,
    status: "Listo",
    price: 11970,
  },
]

const INITIAL_TABLES: Table[] = [
  { id: "t1", number: "Mesa 01", status: "Libre", capacity: 4 },
  { id: "t2", number: "Mesa 02", status: "Preparando", orderId: 102, capacity: 2 },
  { id: "t3", number: "Mesa 03", status: "Esperando", orderId: 105, capacity: 2 },
  { id: "t4", number: "Mesa 04", status: "Esperando", orderId: 101, capacity: 4 },
  { id: "t5", number: "Mesa 05", status: "Libre", capacity: 6 },
  { id: "t6", number: "Mesa 06", status: "Listo", orderId: 106, capacity: 2 },
  { id: "t7", number: "Mesa 07", status: "Listo", orderId: 103, capacity: 4 },
  { id: "t8", number: "Mesa 08", status: "Pagando", capacity: 4 },
]

const ITEM_POOL = [
  { name: "Burger MESA Premium", price: 11990 },
  { name: "Papas Trufadas", price: 6990 },
  { name: "Tacos de Entraña (3 pzs)", price: 9990 },
  { name: "Pizza Diábola Familiar", price: 15990 },
  { name: "Fettuccine Alfredo", price: 12990 },
  { name: "Ensalada César con Pollo", price: 10990 },
  { name: "Ramen Tonkotsu Ahumado", price: 13990 },
  { name: "Copa de Chardonnay", price: 5990 },
  { name: "Aperol Spritz", price: 6990 },
  { name: "Jugo Natural", price: 3490 },
  { name: "Espresso Doble", price: 2990 },
  { name: "Torta de Tres Leches", price: 5990 },
]

export default function WaiterControlSystem() {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isLive, setIsLive] = useState(true)
  const [activeTab, setActiveTab] = useState<"all" | "Nuevo" | "Preparando" | "Listo" | "Entregado">("all")
  const [dailySales, setDailySales] = useState(438500)
  const [avgWaitTime, setAvgWaitTime] = useState(14)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showRaycastConsole, setShowRaycastConsole] = useState(false)
  const [consoleQuery, setConsoleQuery] = useState("")

  const nextOrderId = useRef(107)

  // Toast Helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Cancel order callback (frees the table and filters out the order)
  const cancelOrder = useCallback((orderId: number) => {
    setOrders((prevOrders) => {
      const targetOrder = prevOrders.find((ord) => ord.id === orderId)
      if (!targetOrder) return prevOrders

      triggerToast(`Pedido #${orderId} de ${targetOrder.table} cancelado 🛑`)

      // Sync Table status - release the table back to Libre!
      setTables((prevTables) =>
        prevTables.map((tbl) => {
          if (tbl.number === targetOrder.table) {
            return { ...tbl, status: "Libre", orderId: undefined }
          }
          return tbl
        })
      )

      return prevOrders.filter((ord) => ord.id !== orderId)
    })
    setSelectedOrder(null)
  }, [])

  // Handle order transition
  const advanceOrderStatus = useCallback((orderId: number) => {
    setOrders((prevOrders) =>
      prevOrders.map((ord) => {
        if (ord.id !== orderId) return ord

        let nextStatus: Order["status"] = "Nuevo"
        if (ord.status === "Nuevo") {
          nextStatus = "Preparando"
          triggerToast(`Pedido #${orderId} en preparación en Cocina 🍳`)
        } else if (ord.status === "Preparando") {
          nextStatus = "Listo"
          triggerToast(`¡Pedido #${orderId} LISTO para servir! 🛎️`)
        } else if (ord.status === "Listo") {
          nextStatus = "Entregado"
          setDailySales((prev) => prev + ord.price)
          triggerToast(`Pedido #${orderId} entregado y pagado en ${ord.table} ✅`)
        } else {
          return ord
        }

        // Sync Table status
        setTables((prevTables) =>
          prevTables.map((tbl) => {
            if (tbl.number === ord.table) {
              let tblStatus = tbl.status
              if (nextStatus === "Preparando") tblStatus = "Preparando"
              else if (nextStatus === "Listo") tblStatus = "Listo"
              else if (nextStatus === "Entregado") tblStatus = "Libre"
              return { ...tbl, status: tblStatus }
            }
            return tbl
          })
        )

        return { ...ord, status: nextStatus }
      })
    )
  }, [])

  // Simulate a random new order
  const generateRandomOrder = useCallback(() => {
    const randomTableIndex = Math.floor(Math.random() * tables.length)
    const targetTable = tables[randomTableIndex]

    // Ensure we don't spam busy tables overly much
    const idNum = nextOrderId.current++
    const numItems = Math.floor(Math.random() * 3) + 1
    const items: OrderItem[] = []
    let total = 0

    for (let i = 0; i < numItems; i++) {
      const randomItem = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)]
      const qty = Math.floor(Math.random() * 2) + 1
      items.push({
        name: randomItem.name,
        quantity: qty,
        price: randomItem.price
      })
      total += randomItem.price * qty
    }

    const newOrder: Order = {
      id: idNum,
      table: targetTable.number,
      items,
      minutes: 0,
      status: "Nuevo",
      price: total,
    }

    setOrders((prev) => [newOrder, ...prev])
    setTables((prev) =>
      prev.map((tbl) =>
        tbl.id === targetTable.id ? { ...tbl, status: "Esperando", orderId: idNum } : tbl
      )
    )

    triggerToast(`⚡ Nuevo pedido ingresado: ${targetTable.number} ($${total.toLocaleString("es-CL")})`)
  }, [tables])

  // Simulation loop
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      // 1. Increment all active order minutes
      setOrders((prev) =>
        prev.map((ord) =>
          ord.status !== "Entregado" ? { ...ord, minutes: ord.minutes + 1 } : ord
        )
      )

      // 2. Small chance to auto-advance an order
      const chance = Math.random()
      if (chance < 0.25) {
        const activeOrders = orders.filter((o) => o.status !== "Entregado")
        if (activeOrders.length > 0) {
          const randomOrder = activeOrders[Math.floor(Math.random() * activeOrders.length)]
          advanceOrderStatus(randomOrder.id)
        }
      }

      // 3. Smaller chance to spawn a new order
      if (chance < 0.15) {
        generateRandomOrder()
      }

      // 4. Oscillate wait times slightly
      setAvgWaitTime((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1
        return Math.max(8, Math.min(22, prev + delta))
      })
    }, 6000) // Trigger state updates every 6s (representing simulated minutes)

    return () => clearInterval(interval)
  }, [isLive, orders, advanceOrderStatus, generateRandomOrder])

  // Filters
  const filteredOrders = orders.filter((ord) => activeTab === "all" || ord.status === activeTab)

  // Status style maps matching Linear / Raycast palettes
  const statusColors = {
    Nuevo: {
      dot: "bg-orange-500 shadow-orange-500/50",
      bg: "bg-orange-50 text-orange-700 border-orange-200/50",
      glow: "rgba(249, 115, 22, 0.2)",
    },
    Preparando: {
      dot: "bg-stone-800 shadow-stone-800/40",
      bg: "bg-stone-50 text-stone-700 border-stone-200",
      glow: "rgba(28, 25, 23, 0.1)",
    },
    Listo: {
      dot: "bg-emerald-500 shadow-emerald-500/50",
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
      glow: "rgba(16, 185, 129, 0.25)",
    },
    Entregado: {
      dot: "bg-stone-400 shadow-stone-400/20",
      bg: "bg-stone-100 text-stone-500 border-stone-200/40",
      glow: "rgba(168, 162, 158, 0.1)",
    },
  }

  // Table Status styling
  const getTableStatusStyle = (status: Table["status"]) => {
    switch (status) {
      case "Listo":
        return "border-emerald-200 bg-emerald-50/70 text-emerald-800 ring-2 ring-emerald-500/10 shadow-lg shadow-emerald-500/5"
      case "Preparando":
        return "border-stone-200 bg-stone-50 text-stone-800 ring-2 ring-stone-950/5"
      case "Esperando":
        return "border-orange-200 bg-orange-50/60 text-orange-800 ring-2 ring-orange-500/10 shadow-lg shadow-orange-500/5"
      case "Pagando":
        return "border-amber-200 bg-amber-50/60 text-amber-800 ring-2 ring-amber-500/10"
      default:
        return "border-stone-200/60 bg-white/70 text-stone-500"
    }
  }

  const getTableBadgeDot = (status: Table["status"]) => {
    switch (status) {
      case "Listo":
        return "bg-emerald-500 shadow-[0_0_8px_#10b981]"
      case "Preparando":
        return "bg-stone-900 animate-pulse"
      case "Esperando":
        return "bg-orange-500 shadow-[0_0_8px_#f97316] animate-bounce"
      case "Pagando":
        return "bg-amber-500 shadow-[0_0_8px_#f59e0b]"
      default:
        return "bg-stone-300"
    }
  }

  // Raycast command handler
  const executeConsoleCommand = (cmd: string) => {
    const query = cmd.toLowerCase().trim()
    if (query === "pedido" || query === "nuevo") {
      generateRandomOrder()
    } else if (query === "pausa" || query === "stop") {
      setIsLive(false)
      triggerToast("Simulación en vivo pausada ⏸️")
    } else if (query === "play" || query === "play") {
      setIsLive(true)
      triggerToast("Simulación en vivo activada ▶️")
    } else if (query === "reset" || query === "reiniciar") {
      setOrders(INITIAL_ORDERS)
      setTables(INITIAL_TABLES)
      setDailySales(438500)
      setAvgWaitTime(14)
      triggerToast("Consola de simulación restablecida 🔄")
    } else {
      triggerToast(`Comando no reconocido: "${cmd}"`)
    }
    setConsoleQuery("")
    setShowRaycastConsole(false)
  }

  return (
    <main className="min-h-screen bg-[#FAF9F5] font-sans text-stone-900 selection:bg-orange-100 selection:text-orange-900 pb-20">
      
      {/* Premium Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-card-entrance rounded-2xl border border-stone-200/80 bg-white/95 px-5 py-4 shadow-2xl shadow-stone-900/10 backdrop-blur-xl flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
          <p className="text-sm font-semibold text-stone-800">{toastMessage}</p>
        </div>
      )}

      {/* Raycast Console Overlay */}
      {showRaycastConsole && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/20 pt-32 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl animate-card-entrance">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
              <svg className="h-5 w-5 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Escribe un comando... (nuevo, pausa, play, reset)"
                className="w-full text-sm outline-none text-stone-800 placeholder:text-stone-400"
                value={consoleQuery}
                onChange={(e) => setConsoleQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") executeConsoleCommand(consoleQuery)
                  if (e.key === "Escape") setShowRaycastConsole(false)
                }}
                autoFocus
              />
              <button 
                onClick={() => setShowRaycastConsole(false)}
                className="text-xs font-semibold px-2 py-1 rounded bg-stone-100 text-stone-500 hover:bg-stone-200"
              >
                ESC
              </button>
            </div>
            <div className="p-2 bg-stone-50 max-h-48 overflow-y-auto">
              <div className="text-[11px] font-bold tracking-wider text-stone-400 px-3 py-1">COMANDOS SUGERIDOS</div>
              <button onClick={() => executeConsoleCommand("nuevo")} className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-200/50">
                <span>⚡ Simular nuevo pedido</span>
                <kbd className="text-[10px] text-stone-400 border border-stone-200 px-1.5 py-0.5 rounded bg-white font-mono">nuevo</kbd>
              </button>
              <button onClick={() => executeConsoleCommand("pausa")} className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-200/50">
                <span>⏸️ Pausar simulación en vivo</span>
                <kbd className="text-[10px] text-stone-400 border border-stone-200 px-1.5 py-0.5 rounded bg-white font-mono">pausa</kbd>
              </button>
              <button onClick={() => executeConsoleCommand("play")} className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-200/50">
                <span>▶️ Reanudar simulación en vivo</span>
                <kbd className="text-[10px] text-stone-400 border border-stone-200 px-1.5 py-0.5 rounded bg-white font-mono">play</kbd>
              </button>
              <button onClick={() => executeConsoleCommand("reset")} className="w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-200/50">
                <span>🔄 Restablecer todas las mesas</span>
                <kbd className="text-[10px] text-stone-400 border border-stone-200 px-1.5 py-0.5 rounded bg-white font-mono">reset</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warm Background Subtle Glows */}
      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-orange-100/40 blur-3xl" />
      <div className="absolute top-1/3 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-orange-50/20 blur-3xl animate-pulse-glow" style={{ "--glow-color": "rgba(251, 146, 60, 0.08)" } as React.CSSProperties} />

      {/* Main Header */}
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
              <h1 className="text-xl font-bold tracking-tight text-stone-950">Restaurant Control System</h1>
            </div>
          </div>

          {/* Quick Simulation controls (Raycast style button) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowRaycastConsole(true)}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
            >
              <svg className="h-3.5 w-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Consola de Comandos
              <kbd className="hidden sm:inline-flex text-[9px] text-stone-400 border border-stone-200 px-1 py-0.2 rounded bg-stone-50 font-mono ml-1">⌘K</kbd>
            </button>

            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition ${
                isLive
                  ? "bg-orange-50 border border-orange-200/60 text-orange-800 hover:bg-orange-100/80"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isLive ? "bg-orange-500 animate-ping" : "bg-stone-400"}`} />
              {isLive ? "Simulador: ACTIVO" : "Simulador: PAUSA"}
            </button>

            <button
              onClick={generateRandomOrder}
              className="rounded-full bg-stone-900 border border-stone-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
            >
              + Simular Pedido
            </button>
          </div>
        </div>
      </header>

      {/* Content Layout */}
      <div className="mx-auto max-w-7xl px-6 mt-8">

        {/* 1. Live Operation Metrics (Stripe-like high-contrast metrics) */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:border-stone-300">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">PEDIDOS VIVOS</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold tracking-tight text-stone-950">
                {orders.filter((o) => o.status !== "Entregado").length}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700">En curso</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">Nuevos, preparando o listos</p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:border-stone-300">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">TIEMPO DE ESPERA PROMEDIO</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold tracking-tight text-stone-950 animate-pulse-glow" style={{ "--glow-color": "rgba(249, 115, 22, 0.05)" } as React.CSSProperties}>
                {avgWaitTime} <span className="text-lg font-medium">min</span>
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">Eficiente</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">Basado en cocina simulada</p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:border-stone-300">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">OCUPACIÓN MESAS</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold tracking-tight text-stone-950">
                {Math.round((tables.filter((t) => t.status !== "Libre").length / tables.length) * 100)}%
              </span>
              <span className="text-xs text-stone-600">
                {tables.filter((t) => t.status !== "Libre").length}/{tables.length} ocupadas
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-2">Plano de mesas minimalista</p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:border-stone-300 bg-gradient-to-tr from-white to-orange-50/20">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">VENTAS SIMULADAS HOY</p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold tracking-tight text-stone-950">
                ${dailySales.toLocaleString("es-CL")}
              </span>
              <span className="text-xs font-bold text-emerald-700">+12%</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">Incrementa al marcar Entregado</p>
          </div>
        </section>

        {/* 2. Restaurant minimalist map (Notion Calendar Style Grid) */}
        <section className="mb-10 rounded-[2rem] border border-stone-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 mb-2">
                Restaurante Control Hub
              </div>
              <h2 className="text-lg font-bold tracking-tight text-stone-950">Mapa Interactivo del Local</h2>
              <p className="text-xs text-stone-500 mt-1">Monitorea estados de cada mesa en tiempo real. Presiona una mesa para desplegar información del pedido.</p>
            </div>
            
            {/* Map Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-100 rounded-full px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-stone-300" />
                <span>Libre</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-full px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-bounce" />
                <span>Esperando</span>
              </div>
              <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-stone-900" />
                <span>Preparando</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                <span>Listo</span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Pagando</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 md:grid-cols-8 relative">
            {/* Restaurant Central Kitchen Overlay Line (visual only) */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] border-t border-dashed border-stone-200 -z-0 pointer-events-none" />

            {tables.map((tbl) => {
              const activeOrder = orders.find((o) => o.id === tbl.orderId && o.status !== "Entregado")
              return (
                <button
                  key={tbl.id}
                  onClick={() => setSelectedTable(selectedTable?.id === tbl.id ? null : tbl)}
                  className={`relative z-10 flex flex-col justify-between p-4 h-28 rounded-2xl border text-left transition duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer ${getTableStatusStyle(
                    tbl.status
                  )}`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-[10px] font-bold text-stone-400 tracking-wider">CAP: {tbl.capacity} Pax</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${getTableBadgeDot(tbl.status)}`} />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-stone-900">{tbl.number}</h3>
                    <p className="text-[10px] font-semibold tracking-wide uppercase opacity-80 mt-1">
                      {tbl.status === "Libre" ? "Disponible" : tbl.status}
                    </p>
                  </div>

                  {activeOrder && (
                    <div className="absolute top-1 right-1 flex items-center justify-center bg-orange-500 text-[8px] font-bold text-white rounded-full h-4 w-4">
                      !
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Interactive Floating Details (Notion Calendar detail style) */}
          {selectedTable && (
            <div className="mt-5 p-5 rounded-2xl border border-stone-200/80 bg-stone-50/80 animate-card-entrance flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-stone-900">{selectedTable.number}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    selectedTable.status === "Libre" ? "bg-stone-200 text-stone-600" : "bg-orange-100 text-orange-800"
                  }`}>
                    {selectedTable.status}
                  </span>
                </div>
                {selectedTable.orderId ? (
                  (() => {
                    const ord = orders.find((o) => o.id === selectedTable.orderId)
                    return ord ? (
                      <div className="mt-2 text-xs text-stone-600">
                        <p className="font-semibold text-stone-800">
                          Pedido #{ord.id} • ${ord.price.toLocaleString("es-CL")} • Hace {ord.minutes} min
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                          {ord.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                        </p>
                        {ord.notes && <p className="mt-1 text-[10px] text-orange-600 italic">💡 Nota: {ord.notes}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-500 mt-1">No se encontró información del pedido activo.</p>
                    )
                  })()
                ) : (
                  <p className="text-xs text-stone-500 mt-1">Mesa vacía. Presiona "+ Simular Pedido" para simular que un cliente se sienta a ordenar.</p>
                )}
              </div>

              <div className="flex gap-2">
                {selectedTable.orderId && (() => {
                  const ord = orders.find((o) => o.id === selectedTable.orderId)
                  return ord && ord.status !== "Entregado" ? (
                    <button
                      onClick={() => advanceOrderStatus(ord.id)}
                      className="rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 transition"
                    >
                      Avanzar Pedido (→ {ord.status === "Nuevo" ? "Preparando" : ord.status === "Preparando" ? "Listo" : "Entregar"})
                    </button>
                  ) : null
                })()}
                <button
                  onClick={() => setSelectedTable(null)}
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:border-stone-400 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 3. Kanban Vivo Board (Linear / Toast POS Inspired) */}
        <section>
          {/* Header & Tabs */}
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="text-xs font-bold tracking-widest text-stone-400 uppercase">Monitoreo Operativo</span>
              <h2 className="text-lg font-bold tracking-tight text-stone-950 mt-0.5">Tablero Operativo de Pedidos</h2>
            </div>
            
            {/* View filter tabs (Linear style tabs) */}
            <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 border border-stone-200/50">
              {(["all", "Nuevo", "Preparando", "Listo", "Entregado"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === tab
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {tab === "all" ? "Todos" : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Kanban Columns */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
            
            {/* 1. Column: NUEVO */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
                  <h3 className="text-sm font-bold tracking-tight text-stone-900 uppercase">Nuevos</h3>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
                  {filteredOrders.filter((o) => o.status === "Nuevo").length}
                </span>
              </div>
              
              <div className="flex flex-col gap-3 min-h-[300px]">
                {filteredOrders.filter((o) => o.status === "Nuevo").map((ord) => (
                  <OrderCard key={ord.id} order={ord} config={statusColors.Nuevo} onAdvance={advanceOrderStatus} onCancel={cancelOrder} onSelect={setSelectedOrder} />
                ))}
                {filteredOrders.filter((o) => o.status === "Nuevo").length === 0 && <EmptyColumnState />}
              </div>
            </div>

            {/* 2. Column: EN PREPARACION */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-stone-900 shadow-[0_0_8px_rgba(28,25,23,0.5)]" />
                  <h3 className="text-sm font-bold tracking-tight text-stone-900 uppercase">Preparando</h3>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
                  {filteredOrders.filter((o) => o.status === "Preparando").length}
                </span>
              </div>

              <div className="flex flex-col gap-3 min-h-[300px]">
                {filteredOrders.filter((o) => o.status === "Preparando").map((ord) => (
                  <OrderCard key={ord.id} order={ord} config={statusColors.Preparando} onAdvance={advanceOrderStatus} onCancel={cancelOrder} onSelect={setSelectedOrder} />
                ))}
                {filteredOrders.filter((o) => o.status === "Preparando").length === 0 && <EmptyColumnState />}
              </div>
            </div>

            {/* 3. Column: LISTO */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <h3 className="text-sm font-bold tracking-tight text-stone-900 uppercase">Listos</h3>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
                  {filteredOrders.filter((o) => o.status === "Listo").length}
                </span>
              </div>

              <div className="flex flex-col gap-3 min-h-[300px]">
                {filteredOrders.filter((o) => o.status === "Listo").map((ord) => (
                  <OrderCard key={ord.id} order={ord} config={statusColors.Listo} onAdvance={advanceOrderStatus} onCancel={cancelOrder} onSelect={setSelectedOrder} />
                ))}
                {filteredOrders.filter((o) => o.status === "Listo").length === 0 && <EmptyColumnState />}
              </div>
            </div>

            {/* 4. Column: ENTREGADO */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-stone-300" />
                  <h3 className="text-sm font-bold tracking-tight text-stone-900 uppercase">Completados</h3>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
                  {filteredOrders.filter((o) => o.status === "Entregado").length}
                </span>
              </div>

              <div className="flex flex-col gap-3 min-h-[300px]">
                {filteredOrders.filter((o) => o.status === "Entregado").map((ord) => (
                  <OrderCard key={ord.id} order={ord} config={statusColors.Entregado} onAdvance={advanceOrderStatus} onCancel={cancelOrder} onSelect={setSelectedOrder} />
                ))}
                {filteredOrders.filter((o) => o.status === "Entregado").length === 0 && <EmptyColumnState />}
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Detailed Order Modal (Stripe / Raycast inspired glassmorphism design) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-stone-200/80 bg-[#FAF9F5] p-6 shadow-2xl animate-card-entrance">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Detalles del Pedido</span>
                <h2 className="text-xl font-bold tracking-tight text-stone-950 mt-1">Pedido #{selectedOrder.id} • {selectedOrder.table}</h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusColors[selectedOrder.status].bg}`}>
                <span className={`h-2 w-2 rounded-full ${statusColors[selectedOrder.status].dot}`} />
                {selectedOrder.status}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-stone-200/60 bg-white p-4">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Artículos Ordenados</p>
              <ul className="divide-y divide-stone-100 text-sm text-stone-700">
                {selectedOrder.items.map((item, idx) => (
                  <li key={idx} className="py-2.5 flex justify-between font-semibold">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-stone-100 flex justify-between items-baseline">
                <span className="text-xs text-stone-500 font-medium">Total de la Cuenta:</span>
                <span className="text-lg font-extrabold text-stone-950">${selectedOrder.price.toLocaleString("es-CL")}</span>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="mt-4 rounded-xl bg-orange-50 border border-orange-100/50 p-3.5 text-xs text-orange-800">
                <p className="font-bold">📝 NOTAS DE COCINA:</p>
                <p className="mt-1 leading-relaxed italic">{selectedOrder.notes}</p>
              </div>
            )}

            <div className="mt-4 flex justify-between text-xs text-stone-500 bg-stone-100/80 rounded-xl p-3 border border-stone-200/40">
              <div>
                <span className="font-bold uppercase text-[9px] text-stone-400">TIEMPO VIVO</span>
                <p className="font-semibold text-stone-700 mt-0.5">{selectedOrder.minutes} minutos transcurridos</p>
              </div>
              <div className="text-right">
                <span className="font-bold uppercase text-[9px] text-stone-400">TÁCTICA</span>
                <p className="font-semibold text-stone-700 mt-0.5">Operado por Mesero</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-200/60 pt-4">
              {selectedOrder.status === "Nuevo" && (
                <button
                  onClick={() => cancelOrder(selectedOrder.id)}
                  className="rounded-full bg-red-50 border border-red-200 px-5 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 hover:border-red-300 transition cursor-pointer"
                >
                  Cancelar Pedido 🛑
                </button>
              )}
              
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-600 hover:border-stone-400 transition cursor-pointer"
              >
                Cerrar
              </button>

              {selectedOrder.status !== "Entregado" && (
                <button
                  onClick={() => {
                    advanceOrderStatus(selectedOrder.id)
                    setSelectedOrder(null)
                  }}
                  className="rounded-full bg-stone-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-stone-800 transition cursor-pointer"
                >
                  {selectedOrder.status === "Nuevo" ? "Iniciar Preparación 🍳" : selectedOrder.status === "Preparando" ? "Listo para Servir 🛎️" : "Marcar como Entregado ✅"}
                </button>
              )}
            </div>
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
  onCancel,
  onSelect,
}: {
  order: Order
  config: { dot: string; bg: string; glow: string }
  onAdvance: (id: number) => void
  onCancel: (id: number) => void
  onSelect: (ord: Order) => void
}) {
  return (
    <div
      onClick={() => onSelect(order)}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md animate-card-entrance cursor-pointer ${
        order.status !== "Entregado" ? "animate-float-card hover:border-orange-300" : "opacity-80"
      }`}
      style={{
        boxShadow: `0 4px 20px -2px ${config.glow}, 0 2px 4px -1px rgba(0, 0, 0, 0.04)`,
      } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-bold text-stone-400 uppercase">Orden #{order.id}</span>
          <h4 className="text-sm font-bold text-stone-900 mt-0.5">{order.table}</h4>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${config.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          {order.status}
        </span>
      </div>

      <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-600">
        {order.items.map((item, idx) => (
          <li key={idx} className="flex justify-between font-medium">
            <span>{item.quantity}x {item.name}</span>
            <span className="text-stone-400">${(item.price * item.quantity).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <div className="mt-2 text-[10px] text-orange-600 italic bg-orange-50/50 p-2 rounded-lg border border-orange-100/50">
          ⚠️ Note: {order.notes}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
        <div>
          <p className="text-[9px] text-stone-400 font-bold uppercase">TIEMPO VIVO</p>
          <p className="text-xs font-semibold text-stone-700">{order.minutes} min</p>
        </div>
        
        <div className="flex gap-1.5">
          {order.status === "Nuevo" && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel(order.id)
              }}
              className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-700 hover:bg-red-100 hover:border-red-300 transition cursor-pointer"
            >
              Cancelar 🛑
            </button>
          )}

          {order.status !== "Entregado" ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAdvance(order.id)
              }}
              className="flex items-center gap-1 rounded-full bg-stone-950 px-3 py-1.5 text-[10px] font-semibold text-white shadow transition hover:bg-stone-800 cursor-pointer"
            >
              <span>Siguiente</span>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          ) : (
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Entregado
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyColumnState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 text-center">
      <p className="text-xs text-stone-400 font-medium">Sin pedidos en esta fase</p>
    </div>
  )
}
