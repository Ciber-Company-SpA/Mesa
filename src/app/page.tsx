import Link from "next/link"
import Image from "next/image"
import mesaLogo from "@/image/MESA.svg"
import categoriesIcon from "@/image/categories.png"
import productsIcon from "@/image/products.png"
import tablesIcon from "@/image/tables.png"
import ordersIcon from "@/image/orders.png"
import waitersIcon from "@/image/waiters.png"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import { MENU_TEMPLATES } from "@/lib/menu/templates"
import type { MenuTemplate } from "@/types/restaurant"

type PublicRestaurantRow = {
  id: number
  restaurant_name: string
  restaurant_logo: string | null
  menu_template: MenuTemplate
  restaurant_city: string | null
  product_count: number
  category_count: number
}

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

async function fetchPublicRestaurants(): Promise<PublicRestaurantRow[]> {
  const supabase = createSupabaseAnonClient()
  const { data, error } = await supabase.rpc("list_public_restaurants")
  if (error || !data) return []
  return (data as unknown as PublicRestaurantRow[]) ?? []
}

const TEMPLATE_SWATCH = Object.fromEntries(
  MENU_TEMPLATES.map((t) => [t.id, t.swatch])
) as Record<MenuTemplate, string>

export default async function Home() {
  const restaurants = await fetchPublicRestaurants()

  return (
    <main className="min-h-screen overflow-hidden bg-stone-50 text-stone-950">
      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_34%),linear-gradient(135deg,_#fff7ed_0%,_#fafaf9_52%,_#f5f5f4_100%)]" />

        <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-stone-50/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
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

            <nav className="flex items-center gap-1 text-sm font-semibold text-stone-700 sm:gap-4">
              <a href="#restaurantes" className="hidden rounded-full px-3 py-1.5 transition hover:bg-stone-100 sm:inline">
                Restaurantes
              </a>
              <a href="#como-funciona" className="hidden rounded-full px-3 py-1.5 transition hover:bg-stone-100 sm:inline">
                Cómo funciona
              </a>
              <a href="#contacto" className="hidden rounded-full px-3 py-1.5 transition hover:bg-stone-100 sm:inline">
                Contacto
              </a>
              <Link
                href="/login"
                className="rounded-full bg-stone-950 px-4 py-2 text-white shadow-sm transition hover:bg-stone-800"
              >
                Iniciar sesión
              </Link>
            </nav>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:px-10 lg:pb-20 lg:pt-12">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm">
              Sistema para restaurantes y cafeterías
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">
              {restaurants.length > 0
                ? `Ya somos ${restaurants.length} ${restaurants.length === 1 ? "restaurante" : "restaurantes"} usando MESA.`
                : "Administra tu menú, mesas y pedidos desde un solo lugar."}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-stone-600 sm:text-lg">
              MESA reúne las herramientas principales de tu operación: menú,
              productos, mesas con QR y seguimiento de pedidos. Mirá los locales
              que ya están operando o sumate a la lista.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#restaurantes"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-stone-900/20 transition hover:bg-stone-800"
              >
                Ver restaurantes
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a
                href="#contacto"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
              >
                Sumá tu local
              </a>
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
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RESTAURANTES */}
      <section id="restaurantes" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
              Directorio
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
              Restaurantes en MESA
            </h2>
          </div>
          <p className="hidden text-sm text-stone-600 sm:block">
            {restaurants.length} {restaurants.length === 1 ? "local activo" : "locales activos"}
          </p>
        </div>

        {restaurants.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-stone-500">
              Todavía no hay restaurantes activos. Sumá el tuyo desde el formulario de contacto.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              <Link
                key={r.id}
                href={`/restaurant/${r.id}`}
                className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="relative h-32 w-full"
                  style={{ background: TEMPLATE_SWATCH[r.menu_template] }}
                >
                  {r.restaurant_logo && (
                    <Image
                      src={r.restaurant_logo}
                      alt={r.restaurant_name}
                      width={56}
                      height={56}
                      unoptimized
                      className="absolute bottom-4 left-4 h-14 w-14 rounded-2xl object-cover ring-2 ring-white/60 shadow-md"
                    />
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-stone-950 group-hover:text-orange-600">
                    {r.restaurant_name}
                  </h3>
                  {r.restaurant_city && (
                    <p className="mt-1 text-xs font-medium text-stone-500">
                      📍 {r.restaurant_city}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs font-semibold text-stone-600">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">
                      {r.category_count} {r.category_count === 1 ? "categoría" : "categorías"}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">
                      {r.product_count} {r.product_count === 1 ? "producto" : "productos"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="bg-white">
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

      {/* CONTACTO */}
      <section id="contacto" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] bg-stone-950 px-8 py-12 text-center text-white shadow-2xl shadow-stone-900/20 sm:px-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
            ¿Querés sumar tu restaurante?
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Hablá con un ejecutivo y ponemos tu local a operar en menos de un día.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-300 sm:text-base">
            Te ayudamos a importar tu carta, generar los QR de mesas y capacitar a tu equipo.
          </p>
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
