"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { useEditCategory } from "@/hooks/useEditCategory"

export default function EditCategoryPage() {
  const {
    categoryName,
    setCategoryName,
    loading,
    saving,
    loadError,
    error,
    updateCategory
  } = useEditCategory()

  const [localError, setLocalError] = useState("")
  const inputError = localError || error

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving || loading) return

    const trimmedName = categoryName.trim()

    if (!trimmedName) {
      setLocalError("El nombre de la categoría es obligatorio")
      return
    }

    await updateCategory(trimmedName)
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-5 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link
            href="/admin/categories"
            className="mb-4 inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-600 hover:shadow-md"
          >
            Volver
          </Link>

          <p className="text-sm text-stone-600">Panel admin</p>
          <h1 className="text-3xl font-bold tracking-tight">Editar categoría</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
            Modifica el nombre de la sección que aparece en tu menú.
          </p>
        </header>

        {loading && (
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 text-sm text-stone-600 shadow-xl shadow-stone-900/5">
            Cargando categoría...
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 shadow-xl shadow-red-900/5">
            <h2 className="text-xl font-bold text-red-700">
              No se pudo cargar la categoría
            </h2>
            <p className="mt-2 text-sm leading-6 text-red-600">
              {loadError}
            </p>
            <Link
              href="/admin/categories"
              className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100"
            >
              Volver
            </Link>
          </div>
        )}

        {!loading && !loadError && (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-[2rem] border border-stone-200 bg-white p-4 shadow-xl shadow-stone-900/5 sm:p-6"
          >
            <div className="rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200">
              <label
                htmlFor="category-name"
                className="mb-2 block text-sm font-semibold text-stone-800"
              >
                Nombre de la categoría
              </label>

              <input
                id="category-name"
                type="text"
                required
                disabled={saving}
                value={categoryName}
                onChange={(event) => {
                  setLocalError("")
                  setCategoryName(event.target.value)
                }}
                aria-invalid={Boolean(inputError)}
                aria-describedby={inputError ? "category-name-error" : undefined}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

              {inputError && (
                <p
                  id="category-name-error"
                  className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
                >
                  {inputError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/categories"
                aria-disabled={saving}
                className={`rounded-2xl border border-stone-200 bg-stone-50 px-5 py-3 text-center font-semibold text-stone-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 ${
                  saving ? "pointer-events-none opacity-60" : ""
                }`}
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-xl shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
