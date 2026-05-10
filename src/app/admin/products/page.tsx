import Link from "next/link"

export default function ProductsPage() {
  const productos = [
    {
      id: 1,
      nombre: "Hamburguesa BBQ",
      categoria: "Hamburguesas",
      precio: 8990,
      activo: true
    },
    {
      id: 2,
      nombre: "Pizza Pepperoni",
      categoria: "Pizzas",
      precio: 11990,
      activo: true
    },
    {
      id: 3,
      nombre: "Cheesecake",
      categoria: "Postres",
      precio: 4990,
      activo: false
    }
  ]

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mx-auto max-w-6xl">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              Productos
            </h1>

            <p className="text-zinc-400 mt-2">
              Gestiona los productos de tu restaurante.
            </p>
          </div>

          <Link
            href="/admin/products/create"
            className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600 transition"
            >
            Nuevo producto
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          
          <table className="w-full">
            <thead className="border-b border-zinc-800 bg-zinc-900/50">
              <tr className="text-left">
                <th className="p-4">Producto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Precio</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {productos.map((producto) => (
                <tr
                  key={producto.id}
                  className="border-b border-zinc-800 last:border-none"
                >
                  <td className="p-4 font-medium">
                    {producto.nombre}
                  </td>

                  <td className="p-4 text-zinc-400">
                    {producto.categoria}
                  </td>

                  <td className="p-4">
                    ${producto.precio}
                  </td>

                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        producto.activo
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {producto.activo ? "Activo" : "Oculto"}
                    </span>
                  </td>

                  <td className="p-4">
                    <div className="flex gap-2">
                      <button className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 transition">
                        Editar
                      </button>

                      <button className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>

        </div>

      </div>
    </main>
  )
}