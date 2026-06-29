"use client"

import { useState } from "react"
import { useReservations } from "@/hooks/useReservations"
import { CreateReservationDialog } from "@/components/admin/CreateReservationDialog"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { cancelReservationAction } from "@/app/actions/reservation-actions"
import type { Reservation } from "@/types/reservation"

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isOngoing(reservation: Reservation): boolean {
  const now = Date.now()
  return now >= Date.parse(reservation.starts_at) && now < Date.parse(reservation.ends_at)
}

export default function ReservationsPage() {
  const { reservations, loading, error, refresh } = useReservations()

  const [showCreate, setShowCreate] = useState(false)
  const [toCancel, setToCancel] = useState<Reservation | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function handleCancel() {
    if (!toCancel || cancelling) return
    setCancelling(true)
    try {
      const result = await cancelReservationAction({ reservationId: toCancel.id })
      if (result.ok) {
        setToCancel(null)
        refresh()
      }
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <CreateReservationDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refresh}
      />

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="¿Cancelar esta reserva?"
        description={
          toCancel
            ? `Se liberará la Mesa ${toCancel.tables?.table_number ?? ""} para ${toCancel.customer_name}.`
            : ""
        }
        confirmLabel={cancelling ? "Cancelando..." : "Sí, cancelar"}
        cancelLabel="Volver"
        onConfirm={handleCancel}
        onCancel={() => {
          if (!cancelling) setToCancel(null)
        }}
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Reservas</h2>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200">
              {reservations.length}
            </span>
          </div>
          <p className="text-sm text-stone-600">
            Reservas vigentes. Mientras una mesa está reservada, su QR queda bloqueado para pedidos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          aria-label="Nueva reserva"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-500/35"
        >
          <span>+ Nueva reserva</span>
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center text-xs font-semibold text-stone-500 animate-pulse">
          Cargando reservas...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs font-bold text-red-600 shadow-sm">
          {error}
        </div>
      )}

      {!loading && !error && reservations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center shadow-inner">
          <h3 className="font-bold text-stone-900">No hay reservas vigentes</h3>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-stone-500">
            Cuando un cliente reserve, registrala acá para bloquear la mesa durante su horario.
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mx-auto mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600"
          >
            + Crear primera reserva
          </button>
        </div>
      )}

      {!loading && !error && reservations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reservations.map((reservation) => {
            const ongoing = isOngoing(reservation)
            return (
              <article
                key={reservation.id}
                className="flex min-w-0 flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
              >
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-stone-900">
                        Mesa {reservation.tables?.table_number ?? "—"}
                      </h3>
                      <p className="mt-0.5 truncate text-sm font-semibold text-stone-700">
                        {reservation.customer_name}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                        ongoing
                          ? "bg-orange-50 text-orange-700 ring-orange-600/10"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
                      }`}
                    >
                      {ongoing ? "En curso" : "Próxima"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs">
                    <p className="font-semibold capitalize text-stone-800">
                      {formatDay(reservation.starts_at)}
                    </p>
                    <p className="mt-0.5 font-bold text-stone-900">
                      {formatTime(reservation.starts_at)} – {formatTime(reservation.ends_at)}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1 text-[11px] text-stone-500">
                    {reservation.party_size != null && (
                      <p>👥 {reservation.party_size} {reservation.party_size === 1 ? "persona" : "personas"}</p>
                    )}
                    {reservation.customer_phone && <p>📞 {reservation.customer_phone}</p>}
                    {reservation.source === "whatsapp" && <p className="text-emerald-600">vía WhatsApp</p>}
                    {reservation.notes && <p className="italic text-stone-400">“{reservation.notes}”</p>}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setToCancel(reservation)}
                  className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-center text-xs font-bold text-red-600 transition hover:bg-red-100/50"
                >
                  Cancelar reserva
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
