"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { useTables } from "@/hooks/useTables"
import { useRestaurant } from "@/hooks/useRestaurant"
import { createReservationAction } from "@/app/actions/reservation-actions"

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

// Valor inicial para <input type="datetime-local">: ahora redondeado al
// siguiente bloque de 5 minutos, en hora local.
function defaultStartLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 5 - (d.getMinutes() % 5), 0, 0)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateReservationDialog({ open, onClose, onCreated }: Props) {
  const { tables, loading: loadingTables } = useTables({ page: 1, pageSize: 100 })
  const { restaurant } = useRestaurant()
  const defaultDuration = restaurant?.reservation_duration_minutes ?? 120

  const [tableId, setTableId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [startsAt, setStartsAt] = useState(defaultStartLocal)
  const [durationMinutes, setDurationMinutes] = useState(String(defaultDuration))
  const [customerPhone, setCustomerPhone] = useState("")
  const [partySize, setPartySize] = useState("")
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function resetForm() {
    setTableId("")
    setCustomerName("")
    setStartsAt(defaultStartLocal())
    setDurationMinutes(String(defaultDuration))
    setCustomerPhone("")
    setPartySize("")
    setNotes("")
    setError("")
  }

  function handleClose() {
    if (loading) return
    resetForm()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    const tableIdNum = Number(tableId)
    if (!tableIdNum) {
      setError("Elegí una mesa")
      return
    }
    if (!customerName.trim()) {
      setError("El nombre de la reserva es obligatorio")
      return
    }
    if (!startsAt) {
      setError("Elegí la fecha y hora de inicio")
      return
    }

    const startsAtDate = new Date(startsAt)
    if (Number.isNaN(startsAtDate.getTime())) {
      setError("Fecha y hora inválida")
      return
    }

    setLoading(true)
    setError("")
    try {
      const result = await createReservationAction({
        tableId: tableIdNum,
        customerName: customerName.trim(),
        startsAt: startsAtDate.toISOString(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        customerPhone: customerPhone.trim() || null,
        partySize: partySize ? Number(partySize) : null,
        notes: notes.trim() || null,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      onCreated()
      resetForm()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
  const labelClass = "mb-1.5 block text-xs font-semibold text-stone-700"

  return (
    <Modal
      open={open}
      onClose={handleClose}
      locked={loading}
      size="lg"
      title="Nueva reserva"
      description="La mesa quedará bloqueada durante el horario de la reserva."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="res-table" className={labelClass}>
              Mesa
            </label>
            <select
              id="res-table"
              required
              disabled={loading || loadingTables}
              value={tableId}
              onChange={(e) => {
                setError("")
                setTableId(e.target.value)
              }}
              className={inputClass}
            >
              <option value="">{loadingTables ? "Cargando mesas..." : "Elegí una mesa"}</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  Mesa {table.table_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="res-name" className={labelClass}>
              Nombre del cliente
            </label>
            <input
              id="res-name"
              type="text"
              required
              maxLength={80}
              disabled={loading}
              value={customerName}
              onChange={(e) => {
                setError("")
                setCustomerName(e.target.value)
              }}
              placeholder="Ej: Benjamín Vega"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="res-start" className={labelClass}>
              Fecha y hora de inicio
            </label>
            <input
              id="res-start"
              type="datetime-local"
              required
              disabled={loading}
              value={startsAt}
              onChange={(e) => {
                setError("")
                setStartsAt(e.target.value)
              }}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="res-duration" className={labelClass}>
              Duración (minutos)
            </label>
            <input
              id="res-duration"
              type="number"
              min={15}
              max={720}
              step={15}
              disabled={loading}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder={String(defaultDuration)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="res-phone" className={labelClass}>
              Teléfono <span className="font-normal text-stone-400">(opcional)</span>
            </label>
            <input
              id="res-phone"
              type="tel"
              maxLength={20}
              disabled={loading}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+56912345678"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="res-party" className={labelClass}>
              Personas <span className="font-normal text-stone-400">(opcional)</span>
            </label>
            <input
              id="res-party"
              type="number"
              min={1}
              max={100}
              disabled={loading}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              placeholder="Ej: 4"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="res-notes" className={labelClass}>
            Notas <span className="font-normal text-stone-400">(opcional)</span>
          </label>
          <textarea
            id="res-notes"
            rows={2}
            maxLength={300}
            disabled={loading}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: cumpleaños, mesa cerca de la ventana…"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear reserva"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
