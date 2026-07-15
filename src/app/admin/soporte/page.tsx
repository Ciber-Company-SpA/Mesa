"use client"

import { SupportCenter } from "@/components/support/SupportCenter"

export default function AdminSoportePage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Soporte</h2>
        <p className="mt-1 text-sm text-stone-500">
          Pedí ayuda al equipo MESA y seguí tus tickets: la conversación queda aquí.
        </p>
      </section>
      <SupportCenter />
    </div>
  )
}
