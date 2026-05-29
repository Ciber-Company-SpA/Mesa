import Link from "next/link"
import Image from "next/image"
import mesaLogo from "@/image/MESA.svg"
import categoriesIcon from "@/image/categories.png"
import productsIcon from "@/image/products.png"
import tablesIcon from "@/image/tables.png"
import ordersIcon from "@/image/orders.png"
import waitersIcon from "@/image/waiters.png"

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

const orders = [
  { table: "Mesa 4", item: "Pedido #101 · $25.990", status: "Nuevo", tone: "bg-orange-50 text-orange-700 ring-orange-200/50" },
  { table: "Mesa 2", item: "Pedido #102 · $18.990", status: "En preparación", tone: "bg-stone-950 text-white ring-stone-900/50" },
  { table: "Mesa 7", item: "Pedido #103 · $32.990", status: "Listo", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200/50" },
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-stone-50 text-stone-950">
      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_34%),linear-gradient(135deg,_#fff7ed_0%,_#fafaf9_52%,_#f5f5f4_100%)]" />

        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="flex h-12 w-28 items-center overflow-hidden"
            aria-label="MESA inicio"
          >
            <Image
              src={mesaLogo}
              alt="MESA"
              className="h-full w-full scale-[1.75] object-contain object-center"
              priority
            />
          </Link>

          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link
              href="/login"
              className="rounded-full bg-stone-950 px-4 py-2 text-white shadow-sm transition hover:bg-stone-800"
            >
              Iniciar sesión
            </Link>
          </nav>
        </header>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:px-10 lg:pb-24 lg:pt-14">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm">
              Sistema para restaurantes y cafeterías
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">
              Administra categorías, productos, mesas y pedidos desde una experiencia simple.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 sm:text-lg">
              MESA reúne las herramientas principales de tu operación: menú,
              productos, mesas con QR y seguimiento de pedidos en una web app clara
              para el día a día.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                </svg>
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
                    <p className="mt-2 text-[10px] font-medium text-orange-100">
                      Ver comandas →
                    </p>
                  </div>
                  <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        Mesas totales
                      </p>
                      <span className="text-sm text-stone-400">◫</span>
                    </div>
                    <p className="mt-3 text-4xl font-extrabold tabular-nums text-stone-900">16</p>
                    <p className="mt-2 text-[10px] font-medium text-stone-500">
                      Ver QR y estados →
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    Pedidos Recientes
                  </p>
                  <span className="text-[10px] font-bold text-orange-600">Ver todos</span>
                </div>

                <div className="mt-2 space-y-2">
                  {orders.map((order) => (
                    <div
                      key={order.table}
                      className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-stone-900">{order.table}</p>
                          <p className="mt-0.5 text-[11px] font-medium tabular-nums text-stone-500">{order.item}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-stone-950/5 ${order.tone}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
            Módulos del panel
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
            Todo lo que necesitás para operar tu local.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <div
              key={module.title}
              className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                {module.icon ? (
                  <Image
                    src={module.icon}
                    alt=""
                    className="h-full w-full scale-125 object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-xl bg-orange-100" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-stone-950">{module.title}</h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">{module.description}</p>
            </div>
          ))}
        </div>
      </section>

    </main>
  )
}
