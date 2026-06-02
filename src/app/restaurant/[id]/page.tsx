import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { createSupabaseAnonClient } from "@/lib/supabase/anon"
import { getTemplateDesign } from "@/lib/menu/templates"
import type { MenuTemplate } from "@/types/restaurant"

type Params = Promise<{ id: string }>

type RestaurantRow = {
  id: number
  restaurant_name: string
  restaurant_logo: string | null
  menu_template: MenuTemplate
  restaurant_city: string | null
}

type ProductRow = {
  id: number
  product_name: string
  product_description: string | null
  product_price: number
  product_image: string | null
  category_id: number
  status_id: number
  categories: { category_name: string } | null
  product_variants: Array<{
    id: number
    variant_name: string
    variant_price: number
    variant_image: string | null
  }>
}

type CategoryRow = {
  id: number
  category_name: string
}

async function fetchPublicRestaurant(restaurantId: number) {
  const supabase = createSupabaseAnonClient()

  const [restaurantRes, productsRes, categoriesRes] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, restaurant_name, restaurant_logo, menu_template, restaurant_city")
      .eq("id", restaurantId)
      .maybeSingle(),
    supabase
      .from("products")
      .select(`id, product_name, product_description, product_price, product_image, category_id, status_id, categories ( category_name ), product_variants ( id, variant_name, variant_price, variant_image )`)
      .eq("restaurant_id", restaurantId),
    supabase
      .from("categories")
      .select("id, category_name")
      .eq("restaurant_id", restaurantId),
  ])

  if (restaurantRes.error || !restaurantRes.data) return null

  return {
    restaurant: restaurantRes.data as RestaurantRow,
    products: (productsRes.data ?? []) as unknown as ProductRow[],
    categories: (categoriesRes.data ?? []) as CategoryRow[],
  }
}

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

export default async function PublicRestaurantPage({ params }: { params: Params }) {
  const { id } = await params
  const restaurantId = Number(id)

  if (!restaurantId || Number.isNaN(restaurantId)) notFound()

  const data = await fetchPublicRestaurant(restaurantId)
  if (!data) notFound()

  const { restaurant, products, categories } = data
  const design = getTemplateDesign(restaurant.menu_template)

  const overlayBg =
    restaurant.menu_template === "aurora" ? "bg-[#090d16]"
    : restaurant.menu_template === "cyber-ruby" ? "bg-[#090514]"
    : restaurant.menu_template === "eclipse" ? "bg-[#050507]"
    : restaurant.menu_template === "forest-moss" ? "bg-[#0b1411]"
    : restaurant.menu_template === "nordic-minimal" ? "bg-[#eef3f7]"
    : "bg-stone-950"

  const overlayGradient =
    restaurant.menu_template === "aurora"
      ? "bg-[radial-gradient(circle_at_15%_20%,rgba(91,33,182,0.45)_0%,transparent_50%),radial-gradient(circle_at_85%_80%,rgba(6,182,212,0.3)_0%,transparent_50%)]"
      : restaurant.menu_template === "cyber-ruby"
      ? "bg-[radial-gradient(circle_at_85%_20%,rgba(217,70,239,0.18)_0%,transparent_50%),radial-gradient(circle_at_15%_80%,rgba(29,78,216,0.15)_0%,transparent_50%)]"
      : restaurant.menu_template === "eclipse"
      ? "bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.06)_0%,transparent_50%)]"
      : restaurant.menu_template === "forest-moss"
      ? "bg-[radial-gradient(circle_at_85%_20%,rgba(245,158,11,0.22)_0%,transparent_45%),radial-gradient(circle_at_20%_80%,rgba(22,163,74,0.32)_0%,transparent_60%)]"
      : restaurant.menu_template === "nordic-minimal"
      ? "bg-[linear-gradient(120deg,rgba(235,243,250,1)_0%,rgba(225,235,245,0.6)_40%,rgba(240,244,248,1)_100%)]"
      : "bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.22),_transparent_34%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_58%,_#020617_100%)]"

  const productsByCategory = categories.map((cat) => ({
    category: cat,
    items: products.filter((p) => p.category_id === cat.id && p.status_id === 1),
  })).filter((g) => g.items.length > 0)

  return (
    <main className="relative min-h-screen">
      <div className={`fixed inset-0 -z-10 ${overlayBg}`} />
      <div className={`pointer-events-none fixed inset-0 -z-10 ${overlayGradient}`} />

      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className={`text-xs font-semibold ${design.mesaText} hover:underline`}
          >
            ← Volver a MESA
          </Link>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${design.abiertoBadge}`}>
            Vista pública
          </span>
        </div>

        <header className="mb-6 flex items-start gap-4">
          {restaurant.restaurant_logo ? (
            <Image
              src={restaurant.restaurant_logo}
              alt={restaurant.restaurant_name}
              width={72}
              height={72}
              className="h-18 w-18 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
              unoptimized
            />
          ) : (
            <div className={`flex h-18 w-18 shrink-0 items-center justify-center rounded-2xl ${design.card}`}>
              <span className={`text-2xl font-black ${design.titleClass}`}>
                {restaurant.restaurant_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className={`text-3xl font-black tracking-tight ${design.titleClass}`}>
              {restaurant.restaurant_name}
            </h1>
            {restaurant.restaurant_city && (
              <p className={`mt-1 text-sm ${design.mesaText}`}>
                📍 {restaurant.restaurant_city}
              </p>
            )}
          </div>
        </header>

        <div className={`mb-6 rounded-2xl border border-white/10 p-4 ${design.card}`}>
          <p className={`text-sm font-semibold ${design.cardName}`}>
            Para hacer un pedido, escaneá el código QR de tu mesa.
          </p>
          <p className={`mt-1 text-xs ${design.cardDesc}`}>
            Esta es una vista pública del menú. Los pedidos solo se reciben desde la app del local.
          </p>
        </div>

        {productsByCategory.length === 0 ? (
          <p className={`text-center text-sm ${design.cardDesc}`}>
            Este restaurante todavía no publicó su menú.
          </p>
        ) : (
          <div className="space-y-8">
            {productsByCategory.map(({ category, items }) => (
              <section key={category.id}>
                <h2 className={`mb-3 text-lg font-black uppercase tracking-wider ${design.titleClass}`}>
                  {category.category_name}
                </h2>
                <div className="space-y-3">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className={`flex gap-3 rounded-2xl p-3 ${design.card}`}
                    >
                      <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl ${design.cardImageBg}`}>
                        {item.product_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.product_image} alt={item.product_name} className="h-full w-full object-contain p-1.5" />
                        ) : (
                          <span className={`text-2xl ${design.cardCat}`}>+</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-base font-black leading-tight ${design.cardName}`}>
                          {item.product_name}
                        </p>
                        {item.product_description && (
                          <p className={`mt-1 line-clamp-2 text-xs ${design.cardDesc}`}>
                            {item.product_description}
                          </p>
                        )}
                        {item.product_variants && item.product_variants.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.product_variants.map((v) => (
                              <span
                                key={v.id}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${design.pillInactive}`}
                              >
                                {v.variant_name} · {formatPrice(v.variant_price)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className={`mt-2 text-sm font-black ${design.cardPrice}`}>
                            {formatPrice(item.product_price)}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
