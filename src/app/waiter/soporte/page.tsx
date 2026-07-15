"use client"

import Link from "next/link"
import { SupportCenter } from "@/components/support/SupportCenter"

export default function WaiterSoportePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="mx-auto max-w-4xl px-6 py-6">
        <Link
          href="/waiter/control"
          className="text-sm font-semibold text-stone-500 transition hover:text-orange-600"
        >
          ← Volver a pedidos
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-950">Soporte</h1>
        <p className="mt-1 text-sm text-stone-500">
          ¿Algo no funciona? Avisale al equipo MESA y seguí la respuesta aquí.
        </p>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-10">
        <SupportCenter />
      </main>
    </div>
  )
}
