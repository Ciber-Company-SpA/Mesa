import Link from "next/link"

export default function CategoriesPage() {
  const categorias = [
    "Hamburguesas",
    "Pizzas",
    "Bebidas",
    "Postres"
  ]

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mx-auto max-w-4xl">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              Categorías
            </h1>

            <p className="text-zinc-400 mt-2">
              Organiza las categorías de tu menú.
            </p>
          </div>

          <Link
            href="/admin/categories/create"
            className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600 transition"
            >
            Nueva categoría
            </Link>
        </div>

        <div className="space-y-4">
          {categorias.map((categoria, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div>
                <h2 className="font-semibold text-lg">
                  {categoria}
                </h2>

                <p className="text-sm text-zinc-400">
                  Categoría del menú
                </p>
              </div>

              <div className="flex gap-3">
              <Link
              href={`/admin/categories/${index + 1}/edit`}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition"
              >
              Editar
              </Link>

                <button className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}