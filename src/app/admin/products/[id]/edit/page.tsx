import Link from "next/link"

export default function EditProductPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mx-auto max-w-2xl">

        <div className="mb-8">
          <Link
            href="/admin/products"
            className="text-sm text-orange-500 transition hover:text-orange-400"
          >
            ← Volver a productos
          </Link>

          <h1 className="mt-4 text-3xl font-bold">
            Editar producto
          </h1>

          <p className="mt-2 text-zinc-400">
            Modifica la información del producto.
          </p>
        </div>

        <form className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Nombre del producto
            </label>

            <input
              type="text"
              defaultValue="Hamburguesa BBQ"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Descripción
            </label>

            <textarea
              defaultValue="Hamburguesa con queso cheddar, tocino y salsa BBQ..."
              className="min-h-[120px] w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Precio
            </label>

            <input
              type="number"
              defaultValue="8990"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Categoría
            </label>

            <select
              defaultValue="Hamburguesas"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            >
              <option>Hamburguesas</option>
              <option>Pizzas</option>
              <option>Bebidas</option>
              <option>Postres</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Estado
            </label>

            <select
              defaultValue="Activo"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            >
              <option>Activo</option>
              <option>Oculto</option>
              <option>Agotado</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Imagen del producto
            </label>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-800 px-4 py-8 text-center transition hover:border-orange-500 hover:bg-zinc-800/80">

              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-2xl">
                📷
              </div>

              <span className="text-sm font-semibold text-white">
                Cambiar imagen
              </span>

              <span className="mt-1 text-xs text-zinc-400">
                PNG, JPG o WEBP
              </span>

              <input
                type="file"
                accept="image/*"
                className="hidden"
              />

            </label>
          </div>

          <div className="flex gap-3 pt-2">

            <Link
              href="/admin/products"
              className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold transition hover:bg-zinc-800"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold transition hover:bg-orange-600"
            >
              Guardar cambios
            </button>

          </div>

        </form>

      </div>
    </main>
  )
}