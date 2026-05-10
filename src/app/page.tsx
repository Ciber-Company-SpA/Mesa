import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-4xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-500">
            MESA · Pedidos QR para restaurantes
          </p>

          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            Gestiona pedidos QR sin caos en tu restaurante
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400">
            Crea tu pyme, configura tu menú digital, genera códigos QR para tus
            mesas y recibe pedidos en cocina en tiempo real.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/register"
              className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
            >
              Crear mi restaurante
            </a>

            <a
              href="/login"
              className="rounded-xl border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-900"
            >
              Iniciar sesión
            </a>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="mb-2 font-semibold">Menú QR</h3>
              <p className="text-sm text-zinc-400">
                Tus clientes escanean y ordenan desde el navegador.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="mb-2 font-semibold">Cocina realtime</h3>
              <p className="text-sm text-zinc-400">
                Los pedidos aparecen al instante en pantalla.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="mb-2 font-semibold">Admin simple</h3>
              <p className="text-sm text-zinc-400">
                Edita productos, precios, mesas y categorías.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="mb-2 font-semibold">Offline-first</h3>
              <p className="text-sm text-zinc-400">
                Diseñado para funcionar incluso con WiFi inestable.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
