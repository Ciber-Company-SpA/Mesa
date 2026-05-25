"use client"

import { useState } from "react"

import { useCreateWaiter } from "@/hooks/useCreateWaiter"
import { useWaiters } from "@/hooks/useWaiters"
import { useDeleteWaiter } from "@/hooks/useDeleteWaiter"
import type { WaiterListItem } from "@/services/waiter-service"

const AVATAR_GRADIENTS = [
  "bg-gradient-to-tr from-orange-500 to-amber-500 text-white",
  "bg-gradient-to-tr from-emerald-500 to-teal-500 text-white",
  "bg-gradient-to-tr from-indigo-500 to-blue-500 text-white",
  "bg-gradient-to-tr from-rose-500 to-pink-500 text-white",
  "bg-gradient-to-tr from-purple-500 to-fuchsia-500 text-white",
  "bg-gradient-to-tr from-yellow-500 to-orange-500 text-white",
]

function getAvatarColor(id: number) {
  return AVATAR_GRADIENTS[Math.abs(id) % AVATAR_GRADIENTS.length]
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function WaitersPage() {
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { waiters, loading, error, refresh } = useWaiters()
  const {
    deleteWaiter,
    loading: deleting,
    error: deleteError,
    dialog: deleteDialog,
  } = useDeleteWaiter()

  const {
    waiterName,
    setWaiterName,
    waiterEmail,
    setWaiterEmail,
    loading: creating,
    error: createError,
    created,
    createWaiter,
    resetCreated,
  } = useCreateWaiter()

  const filteredWaiters = waiters.filter((waiter) =>
    waiter.name.toLowerCase().includes(search.toLowerCase()) ||
    (waiter.email ?? "").toLowerCase().includes(search.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await createWaiter()
    if (result) refresh()
  }

  function closeModal() {
    setShowCreateModal(false)
    resetCreated()
  }

  async function handleDelete(waiter: WaiterListItem) {
    const success = await deleteWaiter(waiter.id, waiter.name)
    if (success) refresh()
  }

  return (
    <div className="space-y-6">
      {deleteDialog}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Meseros y Personal</h2>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200">
              {waiters.length}
            </span>
          </div>
          <p className="text-sm text-stone-600">
            Crea cuentas para tu equipo. Cada mesero ingresa con su correo y contraseña.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-500/35"
        >
          <span>+ Agregar Mesero</span>
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <span className="absolute inset-y-0 left-3 flex items-center text-stone-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-4 text-xs font-medium text-stone-700 outline-none ring-offset-1 focus:border-stone-400 focus:bg-white focus:ring-1 focus:ring-stone-400"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {deleteError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {deleteError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {loading ? (
          <div className="col-span-full rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center text-xs font-semibold text-stone-500 animate-pulse">
            Cargando meseros...
          </div>
        ) : filteredWaiters.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
            <p className="text-sm font-semibold text-stone-600">
              {waiters.length === 0
                ? "Aún no has agregado meseros."
                : "No se encontraron meseros con ese criterio."}
            </p>
          </div>
        ) : (
          filteredWaiters.map((waiter) => (
            <article
              key={waiter.id}
              className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold shadow-sm ${getAvatarColor(waiter.id)}`}>
                  {getInitials(waiter.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-stone-900">{waiter.name}</h3>
                  <p className="truncate text-xs text-stone-500">{waiter.email ?? "Sin correo"}</p>
                </div>
              </div>

              <div className="mt-4 flex justify-end border-t border-stone-100 pt-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleDelete(waiter)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Modal: crear mesero */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Agregar mesero</h3>
                <p className="mt-1 text-xs text-stone-600">
                  Se generará una contraseña temporal y se le enviará al correo del mesero.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={creating}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {created ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-bold text-emerald-800">Mesero creado ✓</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {created.emailSent
                      ? `Se enviaron las credenciales a ${created.email}.`
                      : "No se pudo enviar el correo. Comparte estas credenciales manualmente:"}
                  </p>

                  <dl className="mt-3 space-y-2 text-xs">
                    <div>
                      <dt className="font-semibold text-stone-600">Correo</dt>
                      <dd className="font-mono text-stone-900">{created.email}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-stone-600">Contraseña temporal</dt>
                      <dd className="font-mono text-base font-bold text-stone-900 tracking-wider">
                        {created.password}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-[10px] text-emerald-700">
                    En su primer ingreso a /waiter/login se le pedirá cambiar la contraseña.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800"
                >
                  Listo
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="waiter-name" className="mb-1.5 block text-xs font-semibold text-stone-700">
                    Nombre del mesero
                  </label>
                  <input
                    id="waiter-name"
                    type="text"
                    required
                    disabled={creating}
                    value={waiterName}
                    onChange={(e) => setWaiterName(e.target.value)}
                    placeholder="Ej: Camila Pérez"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="waiter-email" className="mb-1.5 block text-xs font-semibold text-stone-700">
                    Correo
                  </label>
                  <input
                    id="waiter-email"
                    type="email"
                    required
                    disabled={creating}
                    value={waiterEmail}
                    onChange={(e) => setWaiterEmail(e.target.value)}
                    placeholder="camila@restaurante.com"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                  />
                </div>

                {createError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {createError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={creating}
                    className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? "Creando..." : "Crear mesero"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
