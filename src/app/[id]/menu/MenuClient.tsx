"use client"

import Link from "next/link"
import { FloatingCartButton } from "@/components/customer/FloatingCartButton"
import { TableOrdersHeader } from "@/components/customer/TableOrdersHeader"
import { useCartSync } from "@/hooks/useCartSync"
import { encodeId } from "@/lib/hashids"
import { useFilteredProducts } from "@/hooks/useFilteredProducts"
import { getTemplateDesign } from "@/lib/menu/templates"
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
  const design = getTemplateDesign(restaurant?.menu_template)

  return (
    <main className={`min-h-screen overflow-hidden pb-28 ${design.mainClass}`}>
      <div className={`pointer-events-none fixed inset-0 ${design.overlayClass}`} />

      <section className="relative mx-auto min-h-screen max-w-md px-4 pb-6 pt-5 md:max-w-2xl md:px-6 lg:max-w-3xl">
        <TableOrdersHeader tableId={tableId ?? null} />

        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${design.mesaText}`}>Mesa {tableNumber}</p>
            <h1 className={`mt-1 truncate text-3xl font-black tracking-tight ${design.titleClass}`}>
              {restaurant?.restaurant_name}
            </h1>
          </div>
          <span className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${design.abiertoBadge}`}>
            Abierto
          </span>
        </header>

        <div className={`sticky top-0 z-30 -mx-4 mt-6 px-4 py-3 ${design.stickyClass}`}>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black shadow-lg transition ${
                selectedCategory === null ? design.pillActive : design.pillInactive
              }`}
            >
              Todo
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black shadow-lg transition ${
                  selectedCategory === cat.id ? design.pillActive : design.pillInactive
                }`}
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
                  <div className={`mb-5 flex items-center justify-between border-b pb-2 ${design.catDivider}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`h-5 w-1 rounded-full ${design.catAccentBar}`} />
                      <h2 className={`text-xl font-black tracking-tight uppercase sm:text-2xl ${design.catTitle}`}>
                        {cat.category_name}
                      </h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm ${design.catCount}`}>
                      {categoryProducts.length} {categoryProducts.length === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {categoryProducts.map((item) => {
                      const isAgotado = item.status_id === 2

                      return isAgotado ? (
                        <div
                          key={item.id}
                          className={`relative flex cursor-not-allowed gap-4 rounded-[1.75rem] p-3 opacity-60 shadow-xl shadow-black/20 ${design.card}`}
                        >
                          <span className="absolute left-4 top-4 z-20 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white shadow-lg">
                            Agotado
                          </span>
                          <ProductImage
                            src={item.product_image}
                            alt={item.product_name}
                            className={`aspect-square h-28 shrink-0 rounded-[1.4rem] ${design.cardImageBg}`}
                            imageClassName="p-3 drop-shadow-xl"
                          />
                          <div className="min-w-0 flex-1 py-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`truncate text-xs font-bold ${design.cardCat}`}>
                                  {item.categories?.category_name}
                                </p>
                                <h3 className={`mt-1 line-clamp-2 font-black leading-tight ${design.cardName}`}>
                                  {item.product_name}
                                </h3>
                              </div>
                              <p className={`shrink-0 text-sm font-black ${design.cardPrice}`}>
                                {formatPrice(item.product_price)}
                              </p>
                            </div>
                            {item.product_description && (
                              <p className={`mt-2 line-clamp-2 text-xs leading-5 ${design.cardDesc}`}>
                                {item.product_description}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Link
                          key={item.id}
                          href={`/${qrCode}/menu/${encodeId(item.id)}`}
                          className={`flex cursor-pointer gap-4 rounded-[1.75rem] p-3 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 ${design.card}`}
                        >
                          <ProductImage
                            src={item.product_image}
                            alt={item.product_name}
                            className={`aspect-square h-28 shrink-0 rounded-[1.4rem] ${design.cardImageBg}`}
                            imageClassName="p-3 drop-shadow-xl"
                          />
                          <div className="min-w-0 flex-1 py-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`truncate text-xs font-bold ${design.cardCat}`}>
                                  {item.categories?.category_name}
                                </p>
                                <h3 className={`mt-1 line-clamp-2 font-black leading-tight ${design.cardName}`}>
                                  {item.product_name}
                                </h3>
                              </div>
                              <p className={`shrink-0 text-sm font-black ${design.cardPrice}`}>
                                {formatPrice(item.product_price)}
                              </p>
                            </div>
                            {item.product_description && (
                              <p className={`mt-2 line-clamp-2 text-xs leading-5 ${design.cardDesc}`}>
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
          <div className={`mt-8 rounded-[2rem] px-6 py-12 text-center shadow-2xl shadow-black/30 ${design.emptyCard}`}>
            <h2 className={`mt-5 text-2xl font-black tracking-tight ${design.emptyTitle}`}>Aún no hay productos disponibles</h2>
          </div>
        )}
      </section>

      {restaurant && tableId ? (
        <FloatingCartButton tableId={tableId} restaurantId={restaurant.id} />
      ) : null}
    </main>
  )
}