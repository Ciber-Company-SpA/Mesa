"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { useEditCategory } from "@/hooks/useEditCategory"

type Props = {
  open: boolean
  categoryId: number | null
  onClose: () => void
  onSaved: () => void
}

export function EditCategoryDialog({ open, categoryId, onClose, onSaved }: Props) {
  const {
    categoryName,
    setCategoryName,
    loading,
    saving,
    loadError,
    error,
    updateCategory,
  } = useEditCategory(open ? categoryId : null)

  const [localError, setLocalError] = useState("")
  const shownError = localError || error

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const trimmed = categoryName.trim()
    if (!trimmed) {
      setLocalError("El nombre de la categoría es obligatorio")
      return
    }

    setLocalError("")
    const ok = await updateCategory(trimmed)
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
      title="Editar categoría"
      description="Modifica el nombre de la sección."
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-stone-500">Cargando categoría...</p>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-category-name" className="mb-1.5 block text-xs font-semibold text-stone-700">
              Nombre de la categoría
            </label>
            <input
              id="edit-category-name"
              type="text"
              required
              disabled={saving}
              value={categoryName}
              onChange={(e) => {
                setLocalError("")
                setCategoryName(e.target.value)
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
