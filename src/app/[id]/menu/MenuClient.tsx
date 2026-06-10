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
import { getTemplateDesign } from "@/lib/menu/templates"
import { flyToCart } from "@/lib/customer/fly-to-cart"
import type { MenuData } from "@/types/menu"
import type { Product } from "@/types/product"
import { useTableCartStore } from "@/store/tableCartStore"


function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

const NEW_PRODUCT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isNewProduct(createdAt: string | null | undefined) {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < NEW_PRODUCT_WINDOW_MS
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
    <div
      aria-label={!src ? `Foto del plato ${placeholder.emoji}` : undefined}
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        backgroundColor: "#241e18",
        backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 11px, transparent 11px 23px)",
      }}
    >
      {src ? (
        <>
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
        <div className="relative z-10 flex flex-col items-center text-center text-[#77695c]">
          <svg className="h-6 w-6 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
          </svg>
          <span className="mt-1 text-[11px] font-medium">Foto del plato</span>
        </div>
      )}
    </div>
  )
}

type ProductCardProps = {
  item: Product
  qrCode: string
  tableId: number | null
  restaurantId: number | null
  isPopular?: boolean
}

function ProductCard({ item, qrCode, tableId, restaurantId, isPopular }: ProductCardProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [showVariants, setShowVariants] = useState(false)
  const { items, addItem, updateQuantity, removeItem } = useTableCart(tableId, restaurantId)
  const variants = item.product_variants ?? []
  const hasVariants = variants.length > 0
  const isAgotado = item.status_id === 2
  const productItems = items.filter((entry) => entry.productId === item.id)
  const cartItem = productItems.find((entry) => entry.variantId === null) ?? null
  const quantity = productItems.reduce((total, entry) => total + entry.quantity, 0)

  function addProduct(productId: number, variantId: number | null, price: number) {
    if (isAgotado || !tableId || !restaurantId) return
    flyToCart(imgRef.current)
    addItem({ productId, variantId, price, quantity: 1 })
  }

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (hasVariants) {
      setShowVariants(true)
      return
    }
    addProduct(item.id, null, item.product_price)
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
    <>
      <article
        className={`group relative overflow-hidden rounded-[20px] border border-[#3a3028] bg-[#1d1814] shadow-[0_12px_30px_rgba(0,0,0,0.28)] ${
          isAgotado ? "opacity-55" : ""
        }`}
      >
        <Link href={`/${qrCode}/menu/${encodeId(item.id)}`} className="block">
          <div className="relative">
            <ProductImage
              src={item.product_image}
              alt={item.product_name}
              className="h-[140px] w-full bg-[#241e18]"
              imageClassName="p-2 transition duration-300 group-hover:scale-[1.02]"
              imgRef={imgRef}
              categoryName={item.categories?.category_name}
            />
            <div className="absolute left-2.5 top-2.5 z-20 flex gap-1.5">
              {isAgotado ? (
                <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-extrabold text-white">
                  Agotado
                </span>
              ) : isNewProduct(item.created_at) ? (
                <span className="rounded-full bg-[#ff5b16] px-2.5 py-1 text-[10px] font-extrabold text-[#17110d]">
                  Nuevo
                </span>
              ) : null}
              {isPopular && !isAgotado ? (
                <span className="rounded-full border border-[#86683f] bg-[#3a2e20]/90 px-2.5 py-1 text-[10px] font-extrabold text-[#ffc46f]">
                  Recomendado
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-h-[126px] px-3.5 pb-4 pt-3">
            <h3 className="font-[family-name:var(--font-grotesk)] text-[17px] font-bold leading-tight tracking-[-0.03em] text-white">
              {item.product_name}
            </h3>
            {item.product_description ? (
              <p className="mt-1 line-clamp-2 pr-12 text-[12px] leading-[1.45] text-[#b8a99c]">
                {item.product_description}
              </p>
            ) : null}
            <p className="mt-3 font-[family-name:var(--font-grotesk)] text-[19px] font-bold text-[#ffbe73]">
              {hasVariants
                ? `Desde ${formatPrice(Math.min(...variants.map((variant) => variant.variant_price)))}`
                : formatPrice(item.product_price)}
            </p>
          </div>
        </Link>

        <div className="absolute bottom-4 right-3.5 z-20">
          {!hasVariants && quantity > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-[#2c241c] p-1 ring-1 ring-white/10">
              <button
                type="button"
                onClick={handleSubtract}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-[#cdbfae]"
                aria-label={`Quitar ${item.product_name}`}
              >
                -
              </button>
              <span className="min-w-5 text-center text-sm font-extrabold text-white">{quantity}</span>
              <button
                type="button"
                onClick={handleAdd}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff5b16] text-lg font-bold text-[#17110d]"
                aria-label={`Agregar otro ${item.product_name}`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isAgotado || !tableId}
              onClick={handleAdd}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff5b16] text-[27px] font-light leading-none text-[#17110d] shadow-[0_8px_18px_rgba(255,91,22,0.35)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={hasVariants ? `Elegir variante de ${item.product_name}` : `Agregar ${item.product_name}`}
            >
              +
            </button>
          )}
        </div>
      </article>

      {showVariants ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`variant-title-${item.id}`}
            className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-[#3a3028] bg-[#18130f] p-5 text-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowVariants(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2c241c] text-xl text-[#cdbfae] ring-1 ring-white/10"
              aria-label="Cerrar selector de variantes"
            >
              x
            </button>

            <div className="pr-12">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#ff7a32]">
                Elige una opcion
              </p>
              <h2
                id={`variant-title-${item.id}`}
                className="mt-1 font-[family-name:var(--font-grotesk)] text-2xl font-bold tracking-tight"
              >
                {item.product_name}
              </h2>
            </div>

            <div className="mt-5 space-y-2.5">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    addProduct(item.id, variant.id, variant.variant_price)
                    setShowVariants(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#3a3028] bg-[#211b15] p-3 text-left transition hover:border-[#ff5b16]/60"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#2c241c]">
                    {variant.variant_image || item.product_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={variant.variant_image ?? item.product_image ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{variant.variant_name}</span>
                    <span className="mt-1 block text-sm font-bold text-[#ffbe73]">
                      {formatPrice(variant.variant_price)}
                    </span>
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff5b16] text-xl text-[#17110d]">
                    +
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

type MenuClientProps = {
  qrCode: string
  menu: MenuData
}

export function MenuClient({ qrCode, menu }: MenuClientProps) {
  const { restaurant, categories, products, tableId, tableNumber } = menu
  const [selectedCategory, setSelectedCategory] = useState<number | null>(categories[0]?.id ?? null)
  const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({})
  useCartSync(restaurant?.id ?? null)
  const setTable = useTableCartStore((s) => s.setTable)
  useEffect(() => {
    setTable(tableId ?? null, restaurant?.id ?? null, qrCode)
  }, [tableId, restaurant?.id, qrCode, setTable])
  const design = getTemplateDesign(restaurant?.menu_template)
  const { info: dinerInfo } = useDinerSlot(tableId ?? null)
  const router = useRouter()
  const { orders: tableOrders } = useTableOrders(tableId ?? null)
  const hasHadOrdersRef = useRef(false)
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
    if (tableOrders.length > 0) {
      hasHadOrdersRef.current = true
      return
    }
    // Transición a 0 pedidos activos en la mesa = mesa cobrada en su totalidad.
    // El RPC server-side ya borró los registros de table_diners, así que el
    // próximo cliente arrancará como Comensal 1.
    if (hasHadOrdersRef.current) {
      router.replace(`/${qrCode}/gracias`)
    }
  }, [tableOrders.length, router, qrCode])

  const availableProducts = useMemo(
    () => products.filter((product) => product.status_id !== 3),
    [products]
  )

  const searchedProducts = useMemo(() => {
    if (!searchQuery.trim()) return availableProducts
    const query = searchQuery.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    return availableProducts.filter((p) => {
      const name = p.product_name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      const desc = (p.product_description ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      return name.includes(query) || desc.includes(query)
    })
  }, [availableProducts, searchQuery])

  function scrollToCategory(categoryId: number) {
    setSelectedCategory(categoryId)
    categoryRefs.current[categoryId]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  return (
    <main className="min-h-screen bg-[#e9e6e1] font-[family-name:var(--font-manrope)] text-[#f7f1e9] sm:py-4">
      <section className="relative mx-auto min-h-screen w-full max-w-[384px] overflow-hidden bg-[#110e0b] pb-28 shadow-[0_30px_80px_rgba(38,27,18,0.28)] sm:min-h-[calc(100vh-32px)] sm:rounded-[38px] sm:border-[10px] sm:border-[#0a0807]">
        <div className="px-3.5 pb-6 pt-5">
        <header className="flex items-center gap-3">
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

        <TableOrdersHeader tableId={tableId ?? null} />

        <div className="sticky top-0 z-30 -mx-3.5 mt-3 border-b border-[#2a231d] bg-[#110e0b]/95 px-3.5 py-2.5 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => scrollToCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${
                  selectedCategory === cat.id
                    ? "bg-[#ff5b16] text-[#15110d] shadow-[0_6px_14px_rgba(255,91,22,0.25)]"
                    : "border border-[#332a23] bg-[#1d1814] text-[#a99f92]"
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
                <div
                  key={cat.id}
                  ref={(element) => {
                    categoryRefs.current[cat.id] = element
                  }}
                  className="scroll-mt-16 animate-card-entrance"
                >
                  <div className="mb-3 mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="h-5 w-1 rounded-full bg-[#ff5b16]" />
                      <h2 className="font-[family-name:var(--font-grotesk)] text-[19px] font-bold tracking-[-0.03em] text-white">
                        {cat.category_name}
                      </h2>
                    </div>
                    <span className="rounded-full bg-[#211b15] px-2.5 py-1 text-[11px] font-bold text-[#a99f92]">
                      {categoryProducts.length}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {categoryProducts.map((item) => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        qrCode={qrCode}
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
        </div>
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
