"use client"

import Link from "next/link"
import { FloatingCartButton } from "@/components/customer/FloatingCartButton"
import { TableOrdersHeader } from "@/components/customer/TableOrdersHeader"
import { useCartSync } from "@/hooks/useCartSync"
import { encodeId } from "@/lib/hashids"
import { useFilteredProducts } from "@/hooks/useFilteredProducts"
import { paletteForBackground, relativeLuminance } from "@/lib/contrast"
import type { MenuData } from "@/types/menu"

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

function ProductImage({
  src,
  alt,
  className,
  imageClassName,
}: {
  src: string | null
  alt: string
  className: string
  imageClassName: string
}) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,146,60,0.22),_transparent_58%)]" />
      <div className="absolute inset-x-8 bottom-4 h-8 rounded-full bg-black/30 blur-xl" />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={`relative z-10 h-full w-full object-contain ${imageClassName}`}
          loading="lazy"
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center text-center text-orange-100/80">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-2xl ring-1 ring-white/10">
            +
          </div>
          <p className="mt-3 text-xs font-bold">Sin imagen</p>
        </div>
      )}
    </div>
  )
}

type MenuClientProps = {
  qrCode: string
  menu: MenuData
}

export function MenuClient({ qrCode, menu }: MenuClientProps) {
  const { restaurant, categories, products, tableId, tableNumber } = menu
  const { filteredProducts, selectedCategory, setSelectedCategory } = useFilteredProducts(products)
  useCartSync(restaurant?.id ?? null)

  const headerType = restaurant?.menu_header_type ?? "solid"
  const headerColor1 = restaurant?.menu_header_color_1 ?? "#0c0a09"
  const headerColor2 = restaurant?.menu_header_color_2 ?? headerColor1
  const headerBackground = headerType === "gradient"
    ? `linear-gradient(180deg, ${headerColor1} 0%, ${headerColor2} 100%)`
    : headerColor1

  const avgLum = headerType === "gradient"
    ? (relativeLuminance(headerColor1) + relativeLuminance(headerColor2)) / 2
    : relativeLuminance(headerColor1)
  const palette = paletteForBackground(avgLum > 0.4 ? "#ffffff" : "#000000")

  return (
    <main
      className="min-h-screen overflow-hidden pb-28"
      style={{ background: headerBackground, color: palette.primary }}
    >

      <section className="relative mx-auto min-h-screen max-w-md px-4 pb-6 pt-5 md:max-w-2xl md:px-6 lg:max-w-3xl">
        <TableOrdersHeader tableId={tableId ?? null} />

        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: palette.secondary }}>Mesa {tableNumber}</p>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight" style={{ color: palette.primary }}>
              {restaurant?.restaurant_name}
            </h1>
          </div>
          <span
            className="shrink-0 rounded-full px-4 py-2 text-xs font-bold ring-1 backdrop-blur"
            style={{ background: palette.pillBackground, color: palette.accent, borderColor: palette.pillRing }}
          >
            Abierto
          </span>
        </header>

        <div className="sticky top-0 z-30 -mx-4 mt-6 px-4 py-3 backdrop-blur-md">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="shrink-0 rounded-full px-5 py-2.5 text-sm font-black shadow-lg transition"
              style={
                selectedCategory === null
                  ? { background: "#f97316", color: "#0c0a09" }
                  : { background: palette.pillBackground, color: palette.pillText }
              }
            >
              Todo
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className="shrink-0 rounded-full px-5 py-2.5 text-sm font-black shadow-lg transition"
                style={
                  selectedCategory === cat.id
                    ? { background: "#f97316", color: "#0c0a09" }
                    : { background: palette.pillBackground, color: palette.pillText }
                }
              >
                {cat.category_name}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <section className="mt-8 space-y-10">
            {categories.map((cat) => {
              const categoryProducts = filteredProducts.filter(
                (item) => item.category_id === cat.id
              )
              if (categoryProducts.length === 0) return null

              return (
                <div key={cat.id} className="animate-card-entrance">
                  <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="h-5 w-1 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                      <h2 className="text-xl font-black tracking-tight uppercase sm:text-2xl" style={{ color: palette.primary }}>
                        {cat.category_name}
                      </h2>
                    </div>
                    <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400 ring-1 ring-orange-500/20 backdrop-blur-sm">
                      {categoryProducts.length} {categoryProducts.length === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {categoryProducts.map((item) => {
                      const isAgotado = item.status_id === 2

                      return isAgotado ? (
                        <div
                          key={item.id}
                          className="relative flex cursor-not-allowed gap-4 rounded-[1.75rem] p-3 opacity-60 shadow-xl shadow-black/20 ring-1 backdrop-blur"
                          style={{ background: palette.cardBackground, boxShadow: `0 0 0 1px ${palette.cardRing}` }}
                        >
                          <span className="absolute left-4 top-4 z-20 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white shadow-lg">
                            Agotado
                          </span>
                          <ProductImage
                            src={item.product_image}
                            alt={item.product_name}
                            className="aspect-square h-28 shrink-0 rounded-[1.4rem] bg-gradient-to-br from-stone-900 via-stone-800 to-orange-950"
                            imageClassName="p-3 drop-shadow-xl"
                          />
                          <div className="min-w-0 flex-1 py-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold" style={{ color: palette.secondary }}>
                                  {item.categories?.category_name}
                                </p>
                                <h3 className="mt-1 line-clamp-2 font-black leading-tight" style={{ color: palette.primary }}>
                                  {item.product_name}
                                </h3>
                              </div>
                              <p className="shrink-0 text-sm font-black" style={{ color: palette.accent }}>
                                {formatPrice(item.product_price)}
                              </p>
                            </div>
                            {item.product_description && (
                              <p className="mt-2 line-clamp-2 text-xs leading-5" style={{ color: palette.pillText }}>
                                {item.product_description}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Link
                          key={item.id}
                          href={`/${qrCode}/menu/${encodeId(item.id)}`}
                          className="flex cursor-pointer gap-4 rounded-[1.75rem] p-3 shadow-xl shadow-black/20 ring-1 backdrop-blur transition hover:-translate-y-0.5"
                          style={{ background: palette.cardBackground, boxShadow: `0 0 0 1px ${palette.cardRing}` }}
                        >
                          <ProductImage
                            src={item.product_image}
                            alt={item.product_name}
                            className="aspect-square h-28 shrink-0 rounded-[1.4rem] bg-gradient-to-br from-stone-900 via-stone-800 to-orange-950"
                            imageClassName="p-3 drop-shadow-xl"
                          />
                          <div className="min-w-0 flex-1 py-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold" style={{ color: palette.secondary }}>
                                  {item.categories?.category_name}
                                </p>
                                <h3 className="mt-1 line-clamp-2 font-black leading-tight" style={{ color: palette.primary }}>
                                  {item.product_name}
                                </h3>
                              </div>
                              <p className="shrink-0 text-sm font-black" style={{ color: palette.accent }}>
                                {formatPrice(item.product_price)}
                              </p>
                            </div>
                            {item.product_description && (
                              <p className="mt-2 line-clamp-2 text-xs leading-5" style={{ color: palette.pillText }}>
                                {item.product_description}
                              </p>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>
        ) : (
          <div
            className="mt-8 rounded-[2rem] px-6 py-12 text-center shadow-2xl shadow-black/30 ring-1 backdrop-blur"
            style={{ background: palette.cardBackground, boxShadow: `0 0 0 1px ${palette.cardRing}` }}
          >
            <h2 className="mt-5 text-2xl font-black tracking-tight" style={{ color: palette.primary }}>Aún no hay productos disponibles</h2>
          </div>
        )}
      </section>

      {restaurant && tableId ? (
        <FloatingCartButton tableId={tableId} restaurantId={restaurant.id} />
      ) : null}
    </main>
  )
}