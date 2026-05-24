"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { encodeId } from "@/lib/hashids"
import { useCategoryList } from "@/hooks/useCategoryList"
import { Pagination } from "@/components/ui/Pagination"

export default function CategoriesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const {
    categories,
    totalCategories,
    totalPages,
    loading,
    deleting,
    error,
    deleteCategory,
    deleteDialog,
  } = useCategoryList({ page: currentPage, pageSize: 12 })

  useEffect(() => {
    if (!loading && currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages, loading])

  return (
    <div className="space-y-6">
      {deleteDialog}

      {/* Encabezado local minimalista con acción de creación */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Categorías de Menú</h2>
          <p className="text-sm text-stone-600">
            Organiza las secciones de tu carta digital para que los clientes naveguen cómodamente.
          </p>
        </div>

        <Link
          href="/admin/categories/create"
          aria-label="Crear categoría"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-500/35"
        >
          <span>+ Agregar Categoría</span>
        </Link>
      </div>

      {/* Panel Principal de Categorías */}
      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl bg-stone-50 px-5 py-3.5 ring-1 ring-stone-200">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Categorías Registradas</p>
            <p className="mt-0.5 text-2xl font-extrabold leading-none tracking-tight text-stone-900">
              {totalCategories}
            </p>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center text-xs font-semibold text-stone-500 animate-pulse">
            Cargando categorías...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs font-bold text-red-650 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && categories.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center shadow-inner">
            <h3 className="font-bold text-stone-900">No hay categorías</h3>
            <p className="mx-auto mt-2 max-w-xs text-xs text-stone-550 leading-relaxed">
              Crea tu primera categoría para comenzar a organizar el menú de tu restaurante.
            </p>
            <Link
              href="/admin/categories/create"
              className="mx-auto mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600"
            >
              + Crear primera categoría
            </Link>
          </div>
        )}

        {!loading && !error && categories.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {categories.map((category) => (
                <article
                  key={category.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-base font-bold text-orange-700 ring-1 ring-orange-200/30">
                      {category.category_name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-stone-900">
                        {category.category_name}
                      </h3>
                      <p className="mt-0.5 text-xs font-medium text-stone-500">
                        Sección activa del menú
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/admin/categories/${encodeId(category.id)}/edit`}
                      className="flex-1 rounded-xl border border-stone-200 bg-stone-50 py-2.5 text-center text-xs font-bold text-stone-750 transition hover:bg-stone-100"
                    >
                      Editar
                    </Link>

                    <button
                      type="button"
                      disabled={deleting}
                      onClick={async () => {
                        await deleteCategory(category.id)
                      }}
                      className="flex-1 rounded-xl border border-red-250 bg-red-50 py-2.5 text-center text-xs font-bold text-red-650 transition hover:bg-red-100/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Eliminar
                    </button>
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
  )
}
