import Link from "next/link"
import Image from "next/image"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"

export const revalidate = 30
import { MENU_TEMPLATES } from "@/lib/menu/templates"
import { PublicHeader } from "@/components/PublicHeader"
import type { MenuTemplate } from "@/types/restaurant"

type PublicRestaurantRow = {
  id: number
  restaurant_name: string
  restaurant_logo: string | null
  menu_template: MenuTemplate
  restaurant_city: string | null
  delivery_slug: string
  product_count: number
  category_count: number
}

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
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
              Directorio MESA
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
              Restaurantes operando con nosotros
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
              Locales que ya tienen su carta, mesas y pedidos en MESA.
              Tocá uno para ver su menú público.
            </p>
          </div>
          <p className="text-sm font-semibold text-stone-500">
            {restaurants.length} {restaurants.length === 1 ? "local activo" : "locales activos"}
          </p>
        </div>

        {restaurants.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-stone-500">
              Todavía no hay restaurantes activos.
            </p>
            <Link
              href="/sumate"
              className="mt-4 inline-flex rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
            >
              Sumá tu local
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              <Link
                key={r.id}
                href={`/${r.delivery_slug}`}
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
                      {r.product_count} {r.product_count === 1 ? "producto" : "productos"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
