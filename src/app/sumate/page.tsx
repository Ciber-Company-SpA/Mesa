import Image from "next/image"
import categoriesIcon from "@/image/categories.png"
import productsIcon from "@/image/products.png"
import tablesIcon from "@/image/tables.png"
import ordersIcon from "@/image/orders.png"
import waitersIcon from "@/image/waiters.png"
import { PublicHeader } from "@/components/PublicHeader"

const modules = [
  {
    title: "Categorías del menú",
    description: "Organiza tu carta por categorías para que cada producto sea fácil de encontrar y editar.",
    icon: categoriesIcon,
  },
  {
    title: "Productos y precios",
    description: "Administra platos, descripciones, precios, estado visible e imagen de cada producto.",
    icon: productsIcon,
  },
  {
    title: "Mesas del local",
    description: "Cada mesa tiene su QR único para que los clientes pidan desde el celular.",
    icon: tablesIcon,
  },
  {
    title: "Seguimiento de pedidos",
    description: "Revisa pedidos por mesa, estado, tiempo de ingreso y total durante el servicio.",
    icon: ordersIcon,
  },
  {
    title: "Gestión de meseros",
    description: "Agregá meseros desde el panel y MESA les envía las credenciales por correo para que accedan al área de meseros.",
    icon: waitersIcon,
  },
]

export default function SumatePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-stone-50 text-stone-950">
      <PublicHeader />

      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_34%),linear-gradient(135deg,_#fff7ed_0%,_#fafaf9_52%,_#f5f5f4_100%)]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:px-10 lg:pb-20 lg:pt-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm">
              Sistema para restaurantes y cafeterías
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">
              Sumá tu restaurante a MESA.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 sm:text-lg">
              Te ayudamos a importar tu carta, generar los QR de mesas y
              capacitar a tu equipo. En menos de un día tu local está operando.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://mesaapp.cl"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
              >
                Contacta a un ejecutivo
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>

            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-sm text-stone-600">
              <div>
                <p className="text-xl font-semibold text-stone-950">Carta</p>
                <p>Categorías y productos</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-stone-950">Mesas</p>
                <p>QR por mesa</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-stone-950">Pedidos</p>
                <p>Estados y totales</p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="absolute -left-8 top-12 h-28 w-28 rounded-full bg-orange-200/70 blur-3xl" />
            <div className="absolute -right-8 bottom-20 h-32 w-32 rounded-full bg-amber-100 blur-3xl" />

            <div className="relative rounded-[2.25rem] border border-stone-200 bg-stone-950 p-3 shadow-2xl shadow-stone-900/20">
              <div className="rounded-[1.75rem] bg-stone-50 p-4">
                <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        Ventas del día
                      </p>
                      <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums text-stone-900">
                        $428.000
                      </p>
                    </div>
                    <div className="rounded-2xl bg-orange-50 px-3 py-2 text-right ring-1 ring-orange-200/50">
                      <p className="text-[10px] font-semibold text-orange-800">pedidos cerrados</p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums text-orange-700">24</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-orange-500 p-4 text-white shadow-lg shadow-orange-500/10">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-100">
                        Pedidos activos
                      </p>
                      <span className="text-sm">▣</span>
                    </div>
                    <p className="mt-3 text-4xl font-extrabold tabular-nums">18</p>
                  </div>
                  <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        Mesas totales
                      </p>
                      <span className="text-sm text-stone-400">◫</span>
                    </div>
                    <p className="mt-3 text-4xl font-extrabold tabular-nums text-stone-900">16</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
              Cómo funciona
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
              Todo lo que necesitás para operar tu local.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((module) => (
              <div
                key={module.title}
                className="rounded-3xl border border-stone-200 bg-stone-50 p-6 shadow-sm"
              >
                <div className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <Image
                    src={module.icon}
                    alt=""
                    className="h-full w-full scale-125 object-cover"
                  />
                </div>
                <h3 className="text-lg font-semibold text-stone-950">{module.title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{module.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] bg-stone-950 px-8 py-12 text-center text-white shadow-2xl shadow-stone-900/20 sm:px-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
            ¿Listo para empezar?
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Hablá con un ejecutivo y ponemos tu local a operar.
          </h2>
          <div className="mt-8">
            <a
              href="https://mesaapp.cl"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600"
            >
              Contacta a un ejecutivo
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
