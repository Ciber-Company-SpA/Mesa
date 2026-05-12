"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useEditProduct } from "@/hooks/useEditProduct"
import { useCategories } from "@/hooks/useCategories"
import { useProductStatus } from "@/hooks/useProductStatus"

export default function EditProductPage() {
  const {
    productName, setProductName,
    productDescription, setProductDescription,
    productPrice, setProductPrice,
    productImage, setProductImage,
    currentImageUrl,
    categoryId, setCategoryId,
    statusId, setStatusId,
    loading, saving,
    loadError, error,
    updateProduct
  } = useEditProduct()

  const { categories } = useCategories()
  const { statuses } = useProductStatus()
  const [imageMenuOpen, setImageMenuOpen] = useState(false)
  const previewUrl = useMemo(
    () => productImage ? URL.createObjectURL(productImage) : "",
    [productImage]
  )

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const imageToShow = previewUrl || currentImageUrl

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-2xl text-sm text-zinc-400">
          Cargando producto...
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="mx-auto max-w-2xl text-sm text-red-400">
          {loadError}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link
            href="/admin/products"
            className="text-sm text-orange-500 transition hover:text-orange-400"
          >
            ← Volver a productos
          </Link>

          <h1 className="mt-4 text-3xl font-bold">Editar producto</h1>

          <p className="mt-2 text-zinc-400">
            Modifica la información del producto.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Nombre del producto
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Descripción
            </label>
            <textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Precio
            </label>
            <input
              type="number"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Categoría
            </label>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Estado
            </label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            >
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Imagen del producto
            </label>

            <input
              id="product-image-edit"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={saving}
              onChange={(e) => {
                setProductImage(e.target.files?.[0] ?? null)
                setImageMenuOpen(false)
              }}
            />

            {imageToShow ? (
              <div
                className="group relative aspect-video overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 bg-cover bg-center shadow-xl"
                style={{ backgroundImage: `url("${imageToShow}")` }}
                onMouseLeave={() => setImageMenuOpen(false)}
              >
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setImageMenuOpen((open) => !open)}
                  className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-sm font-bold leading-none text-white shadow-lg backdrop-blur transition group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                    imageMenuOpen ? "opacity-100" : "opacity-0"
                  }`}
                  aria-label="Opciones de imagen"
                >
                  ...
                </button>

                {imageMenuOpen && (
                  <label
                    htmlFor="product-image-edit"
                    className="absolute right-3 top-14 cursor-pointer rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-black"
                  >
                    Cambiar imagen
                  </label>
                )}
              </div>
            ) : (
              <label
                htmlFor="product-image-edit"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-800 px-4 py-12 text-center transition hover:border-orange-500 hover:bg-zinc-800/80"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700 text-2xl">
                  📷
                </div>
                <span className="text-sm font-semibold text-white">
                  Seleccionar imagen
                </span>
                <span className="mt-1 text-xs text-zinc-400">
                  PNG, JPG o WEBP
                </span>
              </label>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/admin/products"
              className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-800"
            >
              Cancelar
            </Link>

            <button
              onClick={updateProduct}
              disabled={saving}
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold transition hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
