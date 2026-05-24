"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { Pagination } from "@/components/ui/Pagination"
import { useTableList } from "@/hooks/useTableList"
import { encodeId } from "@/lib/hashids"

export default function TablesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const {
    tables,
    totalTables,
    totalPages,
    loading,
    deleting,
    error,
    deleteTable,
    deleteDialog,
  } = useTableList({ page: currentPage, pageSize: 12 })

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
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Mesas y Códigos QR</h2>
          <p className="text-sm text-stone-600">
            Administración de mesas del local y descarga de códigos QR para clientes.
          </p>
        </div>

        <Link
          href="/admin/tables/create"
          aria-label="Crear mesa"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-orange-500/35"
        >
          <span>+ Agregar Mesa</span>
        </Link>
      </div>

      {/* Grid Principal de Mesas */}
      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl bg-stone-50 px-5 py-3.5 ring-1 ring-stone-200">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Total Registradas</p>
            <p className="mt-0.5 text-2xl font-extrabold leading-none tracking-tight text-stone-900">
              {totalTables}
            </p>
          </div>
          <div className="rounded-xl bg-orange-50 px-3 py-2 text-right ring-1 ring-orange-200/50">
            <p className="text-xs font-bold text-orange-700">Autoservicio QR</p>
            <p className="text-[10px] text-stone-500">1 código por mesa</p>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center text-xs font-semibold text-stone-500 animate-pulse">
            Cargando mesas del local...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs font-bold text-red-650 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && tables.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center shadow-inner">
            <h3 className="font-bold text-stone-900">No hay mesas registradas</h3>
            <p className="mx-auto mt-2 max-w-xs text-xs text-stone-550 leading-relaxed">
              Crea tu primera mesa para que los clientes puedan escanear su código QR e iniciar un pedido digital.
            </p>
            <Link
              href="/admin/tables/create"
              className="mx-auto mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600"
            >
              + Crear primera mesa
            </Link>
          </div>
        )}

        {!loading && !error && tables.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((table) => (
                <article
                  key={table.id}
                  className="flex min-w-0 flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <div>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-stone-900">
                          Mesa {table.table_number}
                        </h3>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-stone-500">
                          Código: {table.qr_codes.qr_code}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/10">
                        QR Listo
                      </span>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
                      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl bg-white p-2.5 shadow-sm">
                        <QRCodeSVG
                          value={`${process.env.NEXT_PUBLIC_APP_URL}/${table.qr_codes.qr_code}/menu`}
                          size={92}
                        />
                      </div>
                      <p className="mt-2 text-[10px] font-semibold text-stone-500">
                        Escaneo de menú directo
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Link
                      href={`/admin/tables/${encodeId(table.id)}/edit`}
                      className="min-w-0 rounded-xl border border-stone-200 bg-stone-50 py-2.5 text-center text-xs font-bold text-stone-750 transition hover:bg-stone-100"
                    >
                      Editar
                    </Link>

                    <button
                      type="button"
                      disabled={deleting}
                      onClick={async () => {
                        await deleteTable(table.id, table.qr_code_id)
                      }}
                      className="min-w-0 rounded-xl border border-red-250 bg-red-50 py-2.5 text-center text-xs font-bold text-red-600 transition hover:bg-red-100/50 disabled:cursor-not-allowed disabled:opacity-60"
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
