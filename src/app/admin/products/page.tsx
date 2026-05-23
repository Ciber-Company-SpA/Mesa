"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BackButton } from "@/components/ui/BackButton"
import { Pagination } from "@/components/ui/Pagination"
import { encodeId } from "@/lib/hashids"
import { useProductList } from "@/hooks/useProductList"

const statusLabels: Record<number, string> = {
  1: "Disponible",
  2: "Agotado",
  3: "Deshabilitado",
}

const statusBadgeClasses: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-stone-100 text-stone-600",
}

function getStatusLabel(statusId: number, statusName?: string) {
  return statusName || statusLabels[statusId] || "Estado desconocido"
}

function getStatusActions(statusId: number) {
  if (statusId === 3) {
    return [
      { label: "Marcar como habilitado", nextStatusId: 1 },
    ]
  }

  if (statusId === 2) {
    return [
      { label: "Marcar como deshabilitado", nextStatusId: 3 },
      { label: "Marcar con stock", nextStatusId: 1 },
    ]
  }

  return [
    { label: "Marcar como deshabilitado", nextStatusId: 3 },
    { label: "Marcar como fuera de stock", nextStatusId: 2 },
  ]
}

export default function ProductsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const {
    products,
    totalProducts,
    totalPages,
    loading,
    deleting,
    updatingStatusId,
    error,
    deleteProduct,
    updateProductStatus,
    deleteDialog,
  } = useProductList({ page: currentPage, pageSize: 12 })
  const [openMenuProductId, setOpenMenuProductId] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages, loading])

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-5 text-stone-950 sm:px-6 lg:px-8">
      {deleteDialog}
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <BackButton
              href="/admin"
              label="Volver"
              className="mb-4 inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:text-orange-600 hover:shadow-md"
            />

            <p className="text-sm text-stone-600">Panel admin</p>
            <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
              Gestiona los productos, precios, categorías e imágenes de tu menú.
            </p>
          </div>

          <Link
            href="/admin/products/create"
            aria-label="Crear producto"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-3xl font-semibold leading-none text-white shadow-xl shadow-orange-500/25 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-500/35"
          >
            +
          </Link>
        </header>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-xl shadow-stone-900/5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4 rounded-3xl bg-stone-50 px-5 py-4 ring-1 ring-stone-200">
            <div>
              <p className="text-sm text-stone-600">Productos registrados</p>
              <p className="mt-1 text-4xl font-bold leading-none tracking-tight">
                {totalProducts}
              </p>
            </div>

            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-right">
              <p className="text-sm font-bold text-orange-700">Menú</p>
              <p className="text-sm text-stone-600">con imágenes</p>
            </div>
          </div>

          {loading && (
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600 shadow-inner">
              Cargando productos...
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-600 shadow-sm">
              {error}
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center shadow-inner">
              <h2 className="text-2xl font-bold tracking-tight">
                No hay productos
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-stone-600">
                Crea tu primer producto para comenzar a armar el menú de tu restaurante.
              </p>
              <Link
                href="/admin/products/create"
                aria-label="Crear primer producto"
                className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-3xl font-semibold leading-none text-white shadow-xl shadow-orange-500/25 transition hover:-translate-y-0.5 hover:bg-orange-600"
              >
                +
              </Link>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="group relative flex min-w-0 flex-col rounded-3xl border border-stone-200 bg-white p-4 shadow-lg shadow-stone-900/5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-stone-900/10"
                  >
                    <div className="absolute right-6 top-6 z-10">
                      <button
                        type="button"
                        disabled={updatingStatusId === product.id}
                        onClick={() => {
                          setOpenMenuProductId((currentId) =>
                            currentId === product.id ? null : product.id
                          )
                        }}
                        className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold leading-none text-stone-700 shadow-lg ring-1 ring-stone-200 backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 ${
                          openMenuProductId === product.id
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        }`}
                        aria-label="Opciones de producto"
                      >
                        ...
                      </button>

                      {openMenuProductId === product.id && (
                        <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 text-sm font-semibold text-stone-700 shadow-2xl shadow-stone-900/15">
                          {getStatusActions(product.status_id).map((action) => (
                            <button
                              key={action.nextStatusId}
                              type="button"
                              disabled={updatingStatusId === product.id}
                              onClick={async () => {
                                const success = await updateProductStatus(product.id, action.nextStatusId)
                                if (success) setOpenMenuProductId(null)
                              }}
                              className="block w-full px-4 py-3 text-left transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex h-44 items-center justify-center overflow-hidden rounded-3xl bg-stone-100 ring-1 ring-stone-200">
                      {product.product_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.product_image}
                          alt={product.product_name}
                          className="h-full max-h-40 w-full object-contain p-3"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-stone-400">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                            📷
                          </div>
                          <p className="mt-3 text-sm font-semibold">
                            Sin imagen
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex min-w-0 flex-1 flex-col">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-bold text-stone-950">
                            {product.product_name}
                          </h2>
                          <p className="mt-1 truncate text-sm text-stone-600">
                            {product.categories.category_name}
                          </p>
                        </div>

                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                          statusBadgeClasses[product.status_id] ?? "bg-stone-100 text-stone-600"
                        }`}>
                          {getStatusLabel(product.status_id, product.product_status?.status_name)}
                        </span>
                      </div>

                      {product.product_description && (
                        <p className="mb-4 line-clamp-2 text-sm leading-6 text-stone-600">
                          {product.product_description}
                        </p>
                      )}

                      <div className="mb-4 rounded-3xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
                        <p className="text-sm text-stone-600">Precio</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-stone-950">
                          ${product.product_price.toLocaleString("es-CL")}
                        </p>
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <Link
                          href={`/admin/products/${encodeId(product.id)}/edit`}
                          className="min-w-0 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-center text-sm font-semibold text-stone-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                        >
                          Editar
                        </Link>

                        <button
                          type="button"
                          disabled={deleting}
                          onClick={async () => {
                            await deleteProduct(product.id, product.product_image_public_id)
                          }}
                          className="min-w-0 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                disabled={loading || deleting}
              />
            </>
          )}
        </section>
      </div>
    </main>
  )
}
