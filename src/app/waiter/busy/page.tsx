"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function WaiterBusyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FAF9F5] text-sm font-semibold text-stone-600">
          Cargando...
        </main>
      }
    >
      <WaiterBusyContent />
    </Suspense>
  )
}

function WaiterBusyContent() {
  const tableNumber = useSearchParams().get("tableNumber")

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F5] px-6 text-center">
      <div className="w-full max-w-sm rounded-3xl border border-orange-200/60 bg-white p-8 shadow-lg shadow-orange-500/5">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl">
          🪑
        </div>
        <h1 className="text-lg font-bold tracking-tight text-stone-900">
          Mesa ocupada
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {tableNumber
            ? `La Mesa ${tableNumber} ya está siendo atendida por otro mesero.`
            : "Esta mesa ya está siendo atendida por otro mesero."}{" "}
          Espera a que la libere o coordina con tu compañero.
        </p>

        <Link
          href="/waiter/control"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 transition"
        >
          Volver a mis mesas
        </Link>
      </div>
    </main>
  )
}
