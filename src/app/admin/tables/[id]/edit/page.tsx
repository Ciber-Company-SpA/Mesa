import Link from "next/link"

export default function EditTablePage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-2xl">

        <div className="mb-8">
          <Link
            href="/admin/tables"
            className="text-sm text-orange-500 transition hover:text-orange-400"
          >
            ← Volver a mesas
          </Link>

          <h1 className="mt-4 text-3xl font-bold">
            Editar mesa
          </h1>

          <p className="mt-2 text-zinc-400">
            Modifica los datos de esta mesa.
          </p>
        </div>

        <form className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Número de mesa
            </label>

            <input
              type="number"
              defaultValue="12"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Nombre opcional
            </label>

            <input
              type="text"
              defaultValue="Terraza VIP"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 outline-none transition focus:border-orange-500"
            />
          </div>

          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-800 p-6 text-center">

            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl bg-white font-bold text-zinc-900">
              QR
            </div>


            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold transition hover:bg-orange-600"
              >
                Generar nuevo QR
              </button>

            </div>

          </div>

          <div className="flex gap-3 pt-2">

            <Link
              href="/admin/tables"
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