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

function ProductCard({ item, qrCode, design, tableId, restaurantId, isPopular }: ProductCardProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const { addItem } = useTableCart(tableId, restaurantId)
  const variants = item.product_variants ?? []
  const hasVariants = variants.length > 0
  const isAgotado = item.status_id === 2

  function handleAdd(e: React.MouseEvent, productId: number, variantId: number | null, price: number) {
    e.preventDefault()
    e.stopPropagation()
    if (isAgotado || !tableId || !restaurantId) return
    flyToCart(imgRef.current)
    addItem({ productId, variantId, price, quantity: 1 })
  }

  return (
    <Link
      href={`/${qrCode}/menu/${encodeId(item.id)}`}
      className={`relative flex flex-col gap-3 rounded-[1.75rem] p-4 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 ${
        isAgotado ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${design.card}`}
    >
      {isAgotado ? (
        <span className="absolute left-4 top-4 z-20 rounded-full bg-red-500/90 border border-red-400/20 px-3 py-1 text-xs font-black text-white shadow-lg">
          Agotado
        </span>
      ) : isPopular ? (
        <span className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg animate-pulse-glow">
          🔥 Popular
        </span>
      ) : null}

      <div className="flex gap-3.5">
        <ProductImage
          src={item.product_image}
          alt={item.product_name}
          className={`aspect-square h-20 shrink-0 rounded-[1.2rem] ${design.cardImageBg}`}
          imageClassName="p-2 drop-shadow-xl"
          imgRef={imgRef}
          categoryName={item.categories?.category_name}
        />
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            <h3 className={`line-clamp-2 font-black leading-tight text-sm tracking-tight ${design.cardName}`}>
              {item.product_name}
            </h3>
            {item.product_description && (
              <p className={`mt-1 line-clamp-2 text-[11px] leading-relaxed ${design.cardDesc}`}>
                {item.product_description}
              </p>
            )}
          </div>
          {!hasVariants && (
            <p className={`mt-2 text-sm font-black ${design.cardPrice}`}>
              {formatPrice(item.product_price)}
            </p>
          )}
        </div>
      </div>

      {hasVariants ? (
        <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: `repeat(${Math.min(variants.length, 3)}, minmax(0, 1fr))` }}>
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              disabled={isAgotado || !tableId}
              onClick={(e) => handleAdd(e, item.id, variant.id, variant.variant_price)}
              className={`min-w-0 rounded-xl px-2 py-2 text-center text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${design.pillInactive} hover:scale-[1.02] active:scale-95`}
            >
              <span className="block truncate">{variant.variant_name}</span>
              <span className={`mt-0.5 block text-[10px] ${design.cardPrice}`}>{formatPrice(variant.variant_price)}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={isAgotado || !tableId}
          onClick={(e) => handleAdd(e, item.id, null, item.product_price)}
          className={`mt-1.5 w-full rounded-xl px-4 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${design.pillActive} hover:scale-[1.01] active:scale-95`}
        >
          Agregar al pedido
        </button>
      )}
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

  const isLight = restaurant?.menu_template === "nordic-minimal"

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
    <main className={`min-h-screen overflow-hidden pb-28 ${design.mainClass}`}>
      <div className={`pointer-events-none fixed inset-0 ${design.overlayClass}`} />

      <section className="relative mx-auto min-h-screen max-w-md px-4 pb-6 pt-5 md:max-w-2xl md:px-6 lg:max-w-3xl">
        <TableOrdersHeader tableId={tableId ?? null} />

        {/* Header Premium del Restaurante */}
        <header className={`flex items-center justify-between gap-4 p-4 rounded-3xl ${design.card}`}>
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0 flex items-center justify-center">
              {/* Glowing halo behind logo */}
              <div className={`absolute inset-0 -m-1 rounded-full opacity-60 blur-md animate-pulse-glow ${
                isLight ? "bg-gradient-to-tr from-slate-400 to-slate-500" : "bg-gradient-to-tr from-orange-500 to-amber-400"
              }`} />
              {restaurant?.restaurant_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.restaurant_logo}
                  alt={restaurant.restaurant_name}
                  className={`relative z-10 h-14 w-14 rounded-full border-2 object-cover shadow-lg ${
                    isLight ? "border-slate-300" : "border-white/20"
                  }`}
                />
              ) : (
                <div className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-black shadow-lg ${
                  isLight ? "border-slate-300 bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-800" : "border-white/20 bg-gradient-to-tr from-stone-800 to-stone-900 text-orange-200"
                }`}>
                  {restaurant?.restaurant_name?.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className={`truncate text-2xl font-black tracking-tight leading-tight ${design.titleClass}`}>
                {restaurant?.restaurant_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${design.abiertoBadge}`}>
                  Mesa {tableNumber}
                </span>
                {dinerInfo && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${design.abiertoBadge}`}>
                    {dinerInfo.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wider ${design.abiertoBadge}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Abierto
            </span>
          </div>
        </header>

        {/* Buscador Interactivo */}
        <div className="mt-6 relative">
          <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none ${isLight ? "text-slate-400" : "text-white/40"}`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar platos, bebidas, postres..."
            className={`w-full pl-12 pr-10 py-3.5 text-sm font-semibold rounded-2xl outline-none transition-all duration-300 ring-1 backdrop-blur-xl ${
              design.card
            } ${
              isLight
                ? "placeholder:text-slate-400 text-slate-800 focus:ring-slate-800/40 focus:border-slate-400"
                : "placeholder:text-white/30 text-white focus:ring-orange-400/50"
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className={`absolute inset-y-0 right-3 flex items-center px-2 transition ${isLight ? "text-slate-400 hover:text-slate-600" : "text-white/40 hover:text-white"}`}
              type="button"
            >
              ✕
            </button>
          )}
        </div>

        {/* Categorías */}
        <div className={`sticky top-0 z-30 -mx-4 mt-6 px-4 py-3 ${design.stickyClass}`}>
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

        {/* Listado de Productos */}
        {searchedProducts.length > 0 ? (
          <section className="mt-8 space-y-10">
            {categories.map((cat) => {
              const categoryProducts = searchedProducts.filter(
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
                      {categoryProducts.length} {categoryProducts.length === 1 ? "producto" : "productos"}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
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
          <div className={`mt-8 rounded-[2rem] px-6 py-12 text-center shadow-2xl shadow-black/30 ${design.emptyCard}`}>
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl ${isLight ? "bg-slate-200 text-slate-500" : "bg-white/10 text-orange-200"}`}>
              🔍
            </div>
            <h2 className={`mt-5 text-xl font-black tracking-tight ${design.emptyTitle}`}>
              {searchQuery ? "Sin resultados para tu búsqueda" : "Aún no hay productos disponibles"}
            </h2>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={`mt-4 rounded-xl px-4 py-2 text-xs font-black transition ${design.pillActive}`}
              >
                Limpiar búsqueda
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
