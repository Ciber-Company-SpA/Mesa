import Link from "next/link"

export default function TablesPage() {
  const mesas = [
    { id: 1, numero: 1, qr: "/menu/1" },
    { id: 2, numero: 2, qr: "/menu/2" },
    { id: 3, numero: 3, qr: "/menu/3" },
  ]

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mesas</h1>
            <p className="mt-2 text-zinc-400">
              Gestiona las mesas y sus códigos QR.
            </p>
          </div>

        <Link
            href="/admin/tables/create"
            className="rounded-xl bg-orange-500 px-5 py-3 font-semibold transition hover:bg-orange-600"
            >
            Nueva mesa
        </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {mesas.map((mesa) => (
            <div
              key={mesa.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <h2 className="text-xl font-semibold">Mesa {mesa.numero}</h2>

              <p className="mt-2 text-sm text-zinc-400">
                QR asignado a esta mesa.
              </p>

              <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-800 p-6 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl bg-white text-sm font-bold text-zinc-900">
                  QR
                </div>

                <p className="mt-3 text-xs text-zinc-500">{mesa.qr}</p>
              </div>

              <div className="mt-5 flex gap-2">
                <Link
                href={`/admin/tables/${mesa.id}/edit`}
                className="flex-1 rounded-xl border border-zinc-700 px-3 py-2 text-center text-sm transition hover:bg-zinc-800"
              >
                Editar
              </Link>

                <button className="flex-1 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold transition hover:bg-orange-600">
                  Descargar QR
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}