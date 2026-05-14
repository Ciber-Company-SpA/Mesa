"use client"

import Link from "next/link"
import { ProductOptionsEditor } from "@/components/admin/ProductOptionsEditor"
import { useEditProduct } from "@/hooks/useEditProduct"
import { useCategories } from "@/hooks/useCategories"

export default function EditProductPage() {
  const {
    productName, setProductName,
    productDescription, setProductDescription,
    categoryId, setCategoryId,
    options,
    setOptionName,
    setOptionPrice,
    setOptionImage,
    addOption,
    removeOption,
    loading, saving,
    loadError, error,
    updateProduct
  } = useEditProduct()

  const { categories } = useCategories()

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
            Volver a productos
          </Link>

          <h1 className="mt-4 text-3xl font-bold">Editar producto</h1>

          <p className="mt-2 text-zinc-400">
            Modifica la informacion del producto.
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
              onChange={(event) => setProductName(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Descripcion
            </label>
            <textarea
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Categoria
            </label>
            <select
              value={categoryId ?? ""}
              onChange={(event) => setCategoryId(Number(event.target.value))}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            >
              <option value="">Selecciona una categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          <ProductOptionsEditor
            options={options}
            disabled={saving}
            onAddOption={addOption}
            onRemoveOption={removeOption}
            onOptionNameChange={setOptionName}
            onOptionPriceChange={setOptionPrice}
            onOptionImageChange={setOptionImage}
          />

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
              type="button"
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
