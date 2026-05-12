"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useCreateProduct } from "@/hooks/useCreateProduct"
import { useCategories } from "@/hooks/useCategories"

export default function CreateProductPage() {
  const {
    productName, setProductName,
    productDescription, setProductDescription,
    productPrice, setProductPrice,
    productImage, setProductImage,
    categoryId, setCategoryId,
    loading, error,
    createProduct
  } = useCreateProduct()

  const { categories } = useCategories()
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

          <h1 className="mt-4 text-3xl font-bold">Nuevo producto</h1>

          <p className="mt-2 text-zinc-400">
            Agrega un nuevo producto al menú de tu restaurante.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Nombre del producto
            </label>
            <input
              type="text"
              placeholder="Hamburguesa BBQ"
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
              placeholder="Hamburguesa con queso cheddar, tocino y salsa BBQ..."
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
              placeholder="8990"
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
              Imagen del producto
            </label>

            <input
              id="product-image-create"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={loading}
              onChange={(e) => {
                setProductImage(e.target.files?.[0] ?? null)
                setImageMenuOpen(false)
              }}
            />

            {previewUrl ? (
              <div
                className="group relative aspect-video overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 bg-cover bg-center shadow-xl"
                style={{ backgroundImage: `url("${previewUrl}")` }}
                onMouseLeave={() => setImageMenuOpen(false)}
              >
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

                <button
                  type="button"
                  disabled={loading}
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
                    htmlFor="product-image-create"
                    className="absolute right-3 top-14 cursor-pointer rounded-full bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-black"
                  >
                    Cambiar imagen
                  </label>
                )}
              </div>
            ) : (
              <label
                htmlFor="product-image-create"
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
              onClick={createProduct}
              disabled={loading}
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold transition hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? "Creando..." : "Crear producto"}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
