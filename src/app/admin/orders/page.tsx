export default function OrdersPage() {
  const pedidos = [
    {
      id: 101,
      mesa: 4,
      estado: "Nuevo",
      total: 25990,
      tiempo: "Hace 2 min"
    },
    {
      id: 102,
      mesa: 2,
      estado: "Preparación",
      total: 18990,
      tiempo: "Hace 7 min"
    },
    {
      id: 103,
      mesa: 7,
      estado: "Listo",
      total: 32990,
      tiempo: "Hace 12 min"
    }
  ]

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Pedidos
          </h1>

          <p className="mt-2 text-zinc-400">
            Revisa la actividad y estado de los pedidos.
          </p>
        </div>

        <div className="space-y-4">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                <div>
                  <h2 className="text-xl font-semibold">
                    Pedido #{pedido.id}
                  </h2>

                  <p className="mt-1 text-zinc-400">
                    Mesa {pedido.mesa}
                  </p>
                </div>

                <div className="flex items-center gap-3">

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      pedido.estado === "Nuevo"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : pedido.estado === "Preparación"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {pedido.estado}
                  </span>

                  <span className="text-zinc-400 text-sm">
                    {pedido.tiempo}
                  </span>

                  <span className="rounded-xl bg-zinc-800 px-4 py-2 font-semibold">
                    ${pedido.total}
                  </span>
                </div>

              </div>

              <div className="mt-5 flex gap-2">
                <button className="rounded-xl border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800">
                  Ver detalle
                </button>

                <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold transition hover:bg-orange-600">
                  Cambiar estado
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </main>
  )
}