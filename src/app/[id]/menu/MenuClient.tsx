"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FloatingCartButton } from "@/components/customer/FloatingCartButton"
import { RecommendationsModal } from "@/components/customer/RecommendationsModal"
import { TableOrdersHeader } from "@/components/customer/TableOrdersHeader"
import { getTopProductsTodayAction } from "@/app/actions/recommendation-actions"
import type { RecommendedProduct } from "@/services/recommendation-service"
import { useCartSync } from "@/hooks/useCartSync"
import { useDinerSlot } from "@/hooks/useDinerSlot"
import { useTableCart } from "@/hooks/useTableCart"
import { useTableOrders } from "@/hooks/useTableOrders"
import { encodeId } from "@/lib/hashids"
import { useFilteredProducts } from "@/hooks/useFilteredProducts"
import { getTemplateDesign } from "@/lib/menu/templates"
import { flyToCart } from "@/lib/customer/fly-to-cart"
import type { MenuData } from "@/types/menu"
import type { Product } from "@/types/product"
import { useTableCartStore } from "@/store/tableCartStore"


function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

function getCategoryPlaceholder(categoryName: string) {
  const name = (categoryName ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  if (name.includes("bebida") || name.includes("trago") || name.includes("jugo") || name.includes("coctel") || name.includes("cerv") || name.includes("alcohol") || name.includes("vino") || name.includes("bebestible")) {
    return {
      emoji: "🍹",
      bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500",
    }
  }
  if (name.includes("postre") || name.includes("dulce") || name.includes("helado") || name.includes("torta") || name.includes("pastela") || name.includes("cafe") || name.includes("infusion") || name.includes("te")) {
    return {
      emoji: "🍰",
      bg: "bg-gradient-to-br from-pink-400 via-fuchsia-500 to-purple-600",
    }
  }
  if (name.includes("hamburg") || name.includes("burger") || name.includes("sandwich") || name.includes("completo") || name.includes("churrasco") || name.includes("entrad") || name.includes("picoteo") || name.includes("papa")) {
    return {
      emoji: "🍔",
      bg: "bg-gradient-to-br from-yellow-400 via-amber-500 to-red-600",
    }
  }
  if (name.includes("piz") || name.includes("pasta") || name.includes("italiana")) {
    return {
      emoji: "🍕",
      bg: "bg-gradient-to-br from-red-400 via-orange-500 to-yellow-500",
    }
  }
  if (name.includes("ensalada") || name.includes("sana") || name.includes("vege") || name.includes("vegan")) {
    return {
      emoji: "🥗",
      bg: "bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600",
    }
  }
  if (name.includes("carne") || name.includes("parrilla") || name.includes("asado") || name.includes("pollo") || name.includes("lomo") || name.includes("bife") || name.includes("pescado")) {
    return {
      emoji: "🍖",
      bg: "bg-gradient-to-br from-red-500 via-red-700 to-stone-800",
    }
  }
  return {
    emoji: "🍽️",
    bg: "bg-gradient-to-br from-orange-400 via-amber-500 to-stone-700",
  }
}

function ProductImage({
  src,
  alt,
  className,
  imageClassName,
  imgRef,
  categoryName,
}: {
  src: string | null
  alt: string
  className: string
  imageClassName: string
  imgRef?: React.RefObject<HTMLImageElement | null>
  categoryName?: string
}) {
  const placeholder = getCategoryPlaceholder(categoryName ?? "")
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className} ${!src ? placeholder.bg : ""}`}>
      {src ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,146,60,0.22),_transparent_58%)]" />
          <div className="absolute inset-x-8 bottom-4 h-8 rounded-full bg-black/30 blur-xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={`relative z-10 h-full w-full object-contain ${imageClassName}`}
            loading="lazy"
          />
        </>
      ) : (
        <div className="relative z-10 flex flex-col items-center text-center">
          <span className="text-3xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)] animate-float-card">{placeholder.emoji}</span>
        </div>
      )}
    </div>
  )
}

type ProductCardProps = {
  item: Product
  qrCode: string
  design: ReturnType<typeof getTemplateDesign>
  tableId: number | null
  restaurantId: number | null
  isPopular?: boolean
}

function ProductCard({ item, qrCode, tableId, restaurantId, isPopular }: ProductCardProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const { items, addItem, updateQuantity, removeItem } = useTableCart(tableId, restaurantId)
  const variants = item.product_variants ?? []
  const hasVariants = variants.length > 0
  const isAgotado = item.status_id === 2
  const cartItem = !hasVariants
    ? items.find((entry) => entry.productId === item.id && entry.variantId === null)
    : null
  const quantity = cartItem?.quantity ?? 0

  function handleAdd(e: React.MouseEvent, productId: number, variantId: number | null, price: number) {
    e.preventDefault()
    e.stopPropagation()
    if (isAgotado || !tableId || !restaurantId) return
    flyToCart(imgRef.current)
    addItem({ productId, variantId, price, quantity: 1 })
  }

  function handleSubtract(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!cartItem) return
    if (cartItem.quantity === 1) {
      removeItem(cartItem.id)
      return
    }
    updateQuantity(cartItem.id, cartItem.quantity - 1)
  }

  return (
    <Link
      href={`/${qrCode}/menu/${encodeId(item.id)}`}
      className={`group relative block overflow-hidden rounded-[1.4rem] border border-[#ffecd6]/[0.08] bg-[#211b15] shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 ${
        isAgotado ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      {isAgotado ? (
        <span className="absolute left-3 top-3 z-20 rounded-full bg-red-500/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
          Agotado
        </span>
      ) : isPopular ? (
        <span className="absolute left-3 top-3 z-20 rounded-full bg-[#ff6a1a] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#15110d]">
          Popular
        </span>
      ) : null}

      <ProductImage
        src={item.product_image}
        alt={item.product_name}
        className="h-44 w-full bg-gradient-to-br from-[#2c241c] via-[#211b15] to-[#3a2113]"
        imageClassName="p-3 drop-shadow-2xl transition duration-300 group-hover:scale-[1.03]"
        imgRef={imgRef}
        categoryName={item.categories?.category_name}
      />

      <div className="p-[13px_15px_15px]">
        <h3 className="font-[family-name:var(--font-grotesk)] text-lg font-bold leading-tight tracking-[-0.03em] text-[#f7f1e9]">
          {item.product_name}
        </h3>
        {item.product_description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.4] text-[#a99f92]">
            {item.product_description}
          </p>
        )}

        {hasVariants ? (
          <div
            className="mt-3 grid gap-2"
            style={{ gridTemplateColumns: `repeat(${Math.min(variants.length, 3)}, minmax(0, 1fr))` }}
          >
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                disabled={isAgotado || !tableId}
                onClick={(e) => handleAdd(e, item.id, variant.id, variant.variant_price)}
                className="min-w-0 rounded-xl border border-[#ffecd6]/[0.08] bg-[#2c241c] px-2 py-2 text-center text-xs font-extrabold text-[#cdbfae] transition hover:border-[#ff6a1a]/40 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block truncate">{variant.variant_name}</span>
                <span className="mt-0.5 block text-[10px] text-[#f0c690]">
                  {formatPrice(variant.variant_price)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-[family-name:var(--font-grotesk)] text-[19px] font-bold text-[#f0c690]">
              {formatPrice(item.product_price)}
            </p>
            {quantity > 0 ? (
              <div className="flex items-center gap-1 rounded-full bg-[#2c241c] p-1 ring-1 ring-[#ffecd6]/[0.08]">
                <button
                  type="button"
                  onClick={handleSubtract}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-[#cdbfae] hover:bg-white/5"
                  aria-label={`Quitar ${item.product_name}`}
                >
                  -
                </button>
                <span className="min-w-6 text-center text-sm font-extrabold text-white">{quantity}</span>
                <button
                  type="button"
                  onClick={(e) => handleAdd(e, item.id, null, item.product_price)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff6a1a] text-lg font-bold text-[#15110d] hover:bg-[#ff7b35]"
                  aria-label={`Agregar otro ${item.product_name}`}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isAgotado || !tableId}
                onClick={(e) => handleAdd(e, item.id, null, item.product_price)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff6a1a] text-2xl font-semibold text-[#15110d] shadow-[0_8px_18px_rgba(255,106,26,0.35)] hover:bg-[#ff7b35] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Agregar ${item.product_name}`}
              >
                +
              </button>
            )}
          </div>
        )}
      </div>
    </Link>
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
  const setTable = useTableCartStore((s) => s.setTable)
  useEffect(() => {
    setTable(tableId ?? null, restaurant?.id ?? null, qrCode)
  }, [tableId, restaurant?.id, qrCode, setTable])
  const design = getTemplateDesign(restaurant?.menu_template)
  const { info: dinerInfo } = useDinerSlot(tableId ?? null)
  const router = useRouter()
  const { orders: tableOrders } = useTableOrders(tableId ?? null)
  const [hasHadOrders, setHasHadOrders] = useState(false)
  const { addItem } = useTableCart(tableId ?? null, restaurant?.id ?? null)
  const [showReco, setShowReco] = useState(false)
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const searchParams = useSearchParams()
  const cameFromScan = searchParams.get("from") === "scan"

  useEffect(() => {
    const restaurantId = restaurant?.id
    if (!restaurantId) return
    const today = new Date().toISOString().slice(0, 10)
    const key = `reco-seen-${restaurantId}-${today}`
    if (typeof window === "undefined") return
    try {
      // Si vienen de escanear el QR, ignoramos el flag previo del día.
      if (cameFromScan) {
        window.localStorage.removeItem(key)
      } else if (window.localStorage.getItem(key)) {
        return
      }
    } catch {
      return
    }

    let cancelled = false
    // Inicio del día en la zona horaria del navegador, así calza con
    // el reporte (que usa hora local del admin).
    const localMidnight = new Date()
    localMidnight.setHours(0, 0, 0, 0)
    getTopProductsTodayAction(restaurantId, 3, localMidnight.toISOString())
      .then((res) => {
        if (cancelled || !res.ok || res.data.length === 0) return
        setRecommendations(res.data)
        setShowReco(true)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [restaurant?.id, cameFromScan])

  function dismissReco() {
    setShowReco(false)
    const restaurantId = restaurant?.id
    if (!restaurantId) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      window.localStorage.setItem(`reco-seen-${restaurantId}-${today}`, "1")
    } catch {
      // ignore
    }
  }

  function handleRecoAdd(productId: number, variantId: number | null, price: number) {
    if (!tableId || !restaurant?.id) return
    addItem({ productId, variantId, price, quantity: 1 })
  }

  useEffect(() => {
    if (tableOrders.length > 0 && !hasHadOrders) {
      setHasHadOrders(true)
      return
    }
    // Transición a 0 pedidos activos en la mesa = mesa cobrada en su totalidad.
    // El RPC server-side ya borró los registros de table_diners, así que el
    // próximo cliente arrancará como Comensal 1.
    if (hasHadOrders && tableOrders.length === 0) {
      router.replace(`/${qrCode}/gracias`)
    }
  }, [tableOrders.length, hasHadOrders, router, qrCode])

  const searchedProducts = useMemo(() => {
    if (!searchQuery.trim()) return filteredProducts
    const query = searchQuery.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    return filteredProducts.filter((p) => {
      const name = p.product_name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      const desc = (p.product_description ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      return name.includes(query) || desc.includes(query)
    })
  }, [filteredProducts, searchQuery])

  return (
    <main className="min-h-screen overflow-hidden bg-[#15110d] pb-28 font-[family-name:var(--font-manrope)] text-[#f7f1e9]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,#2a1c10_0%,#15110d_55%)]" />

      <section className="relative mx-auto min-h-screen max-w-md px-4 pb-6 pt-4">
        <TableOrdersHeader tableId={tableId ?? null} />

        <header className="flex items-center gap-3 px-0.5 pt-1">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative flex shrink-0 items-center justify-center">
              {restaurant?.restaurant_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.restaurant_logo}
                  alt={restaurant.restaurant_name}
                  className="h-[54px] w-[54px] rounded-full border-[2.5px] border-[#ff6a1a] object-cover"
                />
              ) : (
                <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full border-[2.5px] border-[#ff6a1a] bg-[#2c241c] font-[family-name:var(--font-grotesk)] text-lg font-bold text-[#f7f1e9]">
                  {restaurant?.restaurant_name?.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="truncate font-[family-name:var(--font-grotesk)] text-xl font-bold leading-tight tracking-[-0.03em] text-[#f7f1e9]">
                {restaurant?.restaurant_name}
              </h1>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="rounded-full bg-[#2c241c] px-2.5 py-1 text-[11px] font-bold text-[#cdbfae]">
                  Mesa {tableNumber}
                </span>
                {dinerInfo && (
                  <span className="rounded-full bg-[#2c241c] px-2.5 py-1 text-[11px] font-bold text-[#cdbfae]">
                    {dinerInfo.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-[#5fd08a]">
              <span className="h-2 w-2 rounded-full bg-[#5fd08a]" />
              Abierto
            </span>
          </div>
        </header>

        <div className="relative mt-4">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#6f675c]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar platos, bebidas, postres..."
            className="h-[50px] w-full rounded-2xl border border-[#ffecd6]/[0.08] bg-[#211b15] pl-12 pr-10 text-[14px] font-medium text-[#f7f1e9] outline-none transition placeholder:text-[#6f675c] focus:border-[#ff6a1a]/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-3 flex items-center px-2 text-[#6f675c] transition hover:text-white"
              type="button"
            >
              x
            </button>
          )}
        </div>

        <div className="sticky top-0 z-30 -mx-4 mt-3 border-b border-[#ffecd6]/[0.08] bg-[#15110d]/90 px-4 py-2.5 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${
                selectedCategory === null
                  ? "bg-[#ff6a1a] text-[#15110d] shadow-[0_6px_14px_rgba(255,106,26,0.27)]"
                  : "border border-[#ffecd6]/[0.08] bg-[#211b15] text-[#a99f92]"
              }`}
            >
              Todo
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${
                  selectedCategory === cat.id
                    ? "bg-[#ff6a1a] text-[#15110d] shadow-[0_6px_14px_rgba(255,106,26,0.27)]"
                    : "border border-[#ffecd6]/[0.08] bg-[#211b15] text-[#a99f92]"
                }`}
              >
                {cat.category_name}
              </button>
            ))}
          </div>
        </div>

        {/* Listado de Productos */}
        {searchedProducts.length > 0 ? (
          <section className="space-y-8">
            {categories.map((cat) => {
              const categoryProducts = searchedProducts.filter(
                (item) => item.category_id === cat.id
              )
              if (categoryProducts.length === 0) return null

              return (
                <div key={cat.id} className="animate-card-entrance">
                  <div className="mb-3 mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="h-5 w-1 rounded-full bg-[#ff6a1a]" />
                      <h2 className="font-[family-name:var(--font-grotesk)] text-xl font-bold tracking-[-0.03em] text-[#f7f1e9]">
                        {cat.category_name}
                      </h2>
                    </div>
                    <span className="rounded-full bg-[#2c241c] px-3 py-1 text-xs font-bold text-[#a99f92]">
                      {categoryProducts.length}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {categoryProducts.map((item) => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        qrCode={qrCode}
                        design={design}
                        tableId={tableId ?? null}
                        restaurantId={restaurant?.id ?? null}
                        isPopular={recommendations.some((r) => r.id === item.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        ) : (
          <div className="mt-8 rounded-[1.5rem] border border-[#ffecd6]/[0.08] bg-[#211b15] px-6 py-12 text-center shadow-2xl shadow-black/30">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2c241c] text-2xl text-[#f0c690]">
              ?
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight text-[#f7f1e9]">
              {searchQuery ? "Sin resultados para tu busqueda" : "Aun no hay productos disponibles"}
            </h2>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-4 rounded-xl bg-[#ff6a1a] px-4 py-2 text-xs font-extrabold text-[#15110d] transition hover:bg-[#ff7b35]"
              >
                Limpiar busqueda
              </button>
            )}
          </div>
        )}
      </section>

      {restaurant && tableId ? (
        <FloatingCartButton tableId={tableId} restaurantId={restaurant.id} />
      ) : null}

      <RecommendationsModal
        isOpen={showReco}
        onClose={dismissReco}
        recommendations={recommendations}
        design={design}
        onAdd={handleRecoAdd}
        canAdd={!!tableId && !!restaurant?.id}
      />
    </main>
  )
}
