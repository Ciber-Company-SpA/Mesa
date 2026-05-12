"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { useCreateTable } from "@/hooks/useCreateTable"

export default function CreateTablePage() {
  const {
    tableNumber,
    setTableNumber,
    loading,
    error,
    createTable
  } = useCreateTable()

  const [localError, setLocalError] = useState("")
  const inputError = localError || error

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loading) return

    const cleanNumber = Number(tableNumber)

    if (!cleanNumber || cleanNumber <= 0) {
      setLocalError("El número de mesa debe ser mayor a 0")
      return
    }

    await createTable()
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-5 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link
            href="/admin/tables"
            className="mb-4 inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-600 hover:shadow-md"
          >
            Volver
          </Link>

          <p className="text-sm text-stone-600">Panel admin</p>
          <h1 className="text-3xl font-bold tracking-tight">Nueva mesa</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
            Crea una mesa y genera automáticamente su código QR.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-[2rem] border border-stone-200 bg-white p-4 shadow-xl shadow-stone-900/5 sm:p-6"
        >
          <div className="rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200">
            <label
              htmlFor="table-number"
              className="mb-2 block text-sm font-semibold text-stone-800"
            >
              Número de mesa
            </label>

            <input
              id="table-number"
              type="number"
              min="1"
              required
              disabled={loading}
              value={tableNumber}
              onChange={(event) => {
                setLocalError("")
                setTableNumber(event.target.value)
              }}
              placeholder="12"
              aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? "table-number-error" : undefined}
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            />

            {inputError && (
              <p
                id="table-number-error"
                className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
              >
                {inputError}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center shadow-inner">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-white font-bold text-stone-900 shadow-sm">
              QR
            </div>
            <p className="mt-3 text-sm text-stone-600">
              El código QR se generará automáticamente al crear la mesa.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin/tables"
              aria-disabled={loading}
              className={`rounded-2xl border border-stone-200 bg-stone-50 px-5 py-3 text-center font-semibold text-stone-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 ${
                loading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-xl shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creando..." : "Crear mesa"}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
