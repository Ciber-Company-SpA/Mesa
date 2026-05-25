"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { useEditTable } from "@/hooks/useEditTable"

type Props = {
  open: boolean
  tableId: number | null
  onClose: () => void
  onSaved: () => void
}

export function EditTableDialog({ open, tableId, onClose, onSaved }: Props) {
  const {
    tableNumber,
    setTableNumber,
    loading,
    saving,
    loadError,
    error,
    updateTable,
  } = useEditTable(open ? tableId : null)

  const [localError, setLocalError] = useState("")
  const shownError = localError || error

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const cleanNumber = Number(tableNumber)
    if (!cleanNumber || cleanNumber <= 0) {
      setLocalError("El número de mesa debe ser mayor a 0")
      return
    }

    setLocalError("")
    const ok = await updateTable()
    if (ok) {
      onSaved()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      title="Editar mesa"
      description="Modifica el número sin cambiar su código QR."
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-stone-500">Cargando mesa...</p>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-table-number" className="mb-1.5 block text-xs font-semibold text-stone-700">
              Número de mesa
            </label>
            <input
              id="edit-table-number"
              type="number"
              min="1"
              required
              disabled={saving}
              value={tableNumber}
              onChange={(e) => {
                setLocalError("")
                setTableNumber(e.target.value)
              }}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
            />
          </div>

          {shownError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {shownError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
