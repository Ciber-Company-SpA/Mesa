"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FloatingCartButton } from "@/components/customer/FloatingCartButton"
import { RecommendationsModal } from "@/components/customer/RecommendationsModal"
import { TableOrdersHeader } from "@/components/customer/TableOrdersHeader"
import { ProductDetailSheet } from "@/components/customer/ProductDetailSheet"
import { ProductImage } from "@/components/customer/ProductImage"
import { getTopProductsTodayAction } from "@/app/actions/recommendation-actions"
import { requestBillAction } from "@/app/actions/service-call-actions"
import type { RecommendedProduct } from "@/services/recommendation-service"
import { useCartSync } from "@/hooks/useCartSync"
import { useDinerSlot } from "@/hooks/useDinerSlot"
import { useTableCart } from "@/hooks/useTableCart"
import { useTableOrders } from "@/hooks/useTableOrders"
import { getTemplateDesign } from "@/lib/menu/templates"
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

type ProductCardProps = {
  item: Product
  isPopular?: boolean
  onOpenDetail: (item: Product) => void
}

function ProductCard({ item, isPopular, onOpenDetail }: ProductCardProps) {
  const variants = item.product_variants ?? []
  const hasVariants = variants.length > 0
  const isAgotado = item.status_id === 2
  const isNew = isNewProduct(item.created_at)

  function open() {
    onOpenDetail(item)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          open()
        }
      }}
      className={`group relative flex min-h-[128px] w-full cursor-pointer items-stretch overflow-hidden rounded-[26px] border border-[#1f1f23] bg-[#161618] text-left transition active:scale-[0.985] ${
        isAgotado ? "opacity-60" : ""
      }`}
    >
      <div className="relative w-[128px] shrink-0">
        <ProductImage
          src={item.product_image}
          alt={item.product_name}
          className="h-full w-full"
          hasBackground={!item.image_recortada}
          fade="right"
        />
        <div className="absolute left-2.5 top-2.5 z-[3] flex flex-col items-start gap-1.5">
          {isAgotado ? (
            <span className="rounded-full bg-[#dc2626] px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-[0.04em] text-white">
              Agotado
            </span>
          ) : isNew ? (
            <span className="rounded-full bg-[#fb923c] px-2 py-[3px] text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#1a1a1a]">
              Nuevo
            </span>
          ) : null}
          {isPopular && !isAgotado ? (
            <span className="rounded-full bg-black/55 px-2 py-[3px] text-[9px] font-bold text-[#fbbf24] backdrop-blur">
              ★ Popular
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center py-3.5 pl-1 pr-2">
        <h3 className="line-clamp-2 font-[family-name:var(--font-grotesk)] text-[16px] font-bold leading-tight tracking-[-0.01em] text-[#fafafa]">
          {item.product_name}
        </h3>
        {item.product_description ? (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[#a1a1aa]">
            {item.product_description}
          </p>
        ) : null}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-[family-name:var(--font-grotesk)] text-[17px] font-extrabold text-[#fb923c]">
            {hasVariants
              ? `Desde ${formatPrice(Math.min(...variants.map((variant) => variant.variant_price)))}`
              : formatPrice(item.product_price)}
          </span>
        </div>
      </div>

      {/* El "+" no agrega directo: lleva al detalle (igual que tocar la card). */}
      <div className="flex shrink-0 items-center pr-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            open()
          }}
          aria-label={`Ver ${item.product_name}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fb923c] text-[22px] font-light leading-none text-[#1a1a1a] shadow-[0_8px_18px_rgba(251,146,60,0.22)] transition active:scale-90"
        >
          +
        </button>
      </div>
    </div>
  )
}

type MenuClientProps = {
  qrCode: string
  menu: MenuData
}

export function MenuClient({ qrCode, menu }: MenuClientProps) {
  const { restaurant, categories, products, tableId, tableNumber } = menu
  useCartSync(restaurant?.id ?? null)
  const setTable = useTableCartStore((s) => s.setTable)
  useEffect(() => {
    setTable(tableId ?? null, restaurant?.id ?? null, qrCode)
  }, [tableId, restaurant?.id, qrCode, setTable])
  // El menú de pedido es de tema fijo (oscuro); forzamos el modal de
  // recomendaciones al diseño oscuro para que no choque con plantillas claras.
  const design = getTemplateDesign("noche")
  const { info: dinerInfo } = useDinerSlot(tableId ?? null, qrCode)
  const router = useRouter()
  const { orders: tableOrders } = useTableOrders(qrCode)
  const hasHadOrdersRef = useRef(false)
  const { addItem } = useTableCart(tableId ?? null, restaurant?.id ?? null)
  const [showReco, setShowReco] = useState(false)
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCat, setActiveCat] = useState<number | "all">("all")
  const [billStatus, setBillStatus] = useState<"idle" | "sending" | "requested">("idle")
  const [toast, setToast] = useState<string | null>(null)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  const searchParams = useSearchParams()
  const cameFromScan = searchParams.get("from") === "scan"

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 1900)
    return () => window.clearTimeout(t)
  }, [toast])

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
    setToast("Agregado al pedido")
  }

  async function handleRequestBill() {
    if (!qrCode || billStatus !== "idle") return
    setBillStatus("sending")
    try {
      const res = await requestBillAction(qrCode, dinerInfo?.token ?? null)
      if (res.ok) {
        setBillStatus("requested")
        setToast("Pedimos tu cuenta · un mesero irá a tu mesa")
      } else {
        setBillStatus("idle")
        setToast("No se pudo pedir la cuenta")
      }
    } catch {
      setBillStatus("idle")
      setToast("No se pudo pedir la cuenta")
    }
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

  // Solo categorías con al menos un producto disponible.
  const visibleCategories = useMemo(
    () => categories.filter((cat) => availableProducts.some((product) => product.category_id === cat.id)),
    [categories, availableProducts]
  )

  // Categoría efectiva: "all" (Todos) por defecto, o la activa si sigue siendo
  // válida; si la activa ya no existe, vuelve a "all". Se deriva en render (sin
  // setState en efecto) para que el primer render ya muestre productos.
  const effectiveCat = useMemo<number | "all">(() => {
    if (activeCat === "all") return "all"
    if (visibleCategories.some((c) => c.id === activeCat)) return activeCat
    return "all"
  }, [activeCat, visibleCategories])

  const searchedProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    if (!query) return []
    return availableProducts.filter((p) => {
      const name = p.product_name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      const desc = (p.product_description ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      return name.includes(query) || desc.includes(query)
    })
  }, [availableProducts, searchQuery])

  const isSearching = searchQuery.trim().length > 0
  const displayedProducts = useMemo(() => {
    if (isSearching) return searchedProducts
    if (effectiveCat === "all") return availableProducts
    return availableProducts.filter((p) => p.category_id === effectiveCat)
  }, [isSearching, searchedProducts, availableProducts, effectiveCat])

  return (
    <main className="min-h-screen bg-black font-[family-name:var(--font-manrope)] text-[#fafafa] sm:py-4">
      <section className="relative mx-auto flex min-h-screen w-full flex-col overflow-clip bg-[#0a0a0b] pb-28 shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:min-h-[calc(100vh-32px)] sm:max-w-[440px] sm:rounded-[38px] sm:border-[10px] sm:border-[#050506]">
        {/* ── Cabecera (marca + cuenta) ── */}
        <div className="px-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {restaurant?.restaurant_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.restaurant_logo}
                  alt={restaurant.restaurant_name}
                  className="h-9 w-9 shrink-0 rounded-full border border-[#fb923c]/60 object-cover"
                />
              ) : (
                <span className="text-lg" aria-hidden="true">🍽️</span>
              )}
              <h1 className="truncate font-[family-name:var(--font-grotesk)] text-[21px] font-extrabold tracking-[-0.02em] text-[#fafafa]">
                {restaurant?.restaurant_name}
              </h1>
            </div>

            <button
              type="button"
              onClick={handleRequestBill}
              disabled={billStatus !== "idle"}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition active:scale-95 ${
                billStatus === "requested"
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
                  : "bg-[#fb923c] text-[#1a1a1a] disabled:opacity-70"
              }`}
            >
              {billStatus === "requested"
                ? "Cuenta pedida ✓"
                : billStatus === "sending"
                  ? "Pidiendo..."
                  : "🧾 Pedir la cuenta"}
            </button>
          </div>

          {/* ── Tira de mesa ── */}
          <div className="mt-3 flex items-center gap-1.5">
            <span className="rounded-full bg-[#fb923c] px-2.5 py-1 text-[11.5px] font-bold text-[#1a1a1a]">
              Mesa {tableNumber}
            </span>
            {dinerInfo && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-[12px] text-[#a1a1aa]">{dinerInfo.label}</span>
              </>
            )}
          </div>

          {/* ── Pedidos en curso ── */}
          <TableOrdersHeader qrCode={qrCode} />
        </div>

        {/* ── Buscador + categorías (sticky) ── */}
        <div className="sticky top-0 z-30 border-b border-[#1f1f23] bg-[#0a0a0b]/92 px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex h-11 items-center gap-2.5 rounded-2xl border border-[#27272a] bg-[#18181b] px-3.5">
            <svg className="h-[18px] w-[18px] shrink-0 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar platos, ingredientes…"
              className="h-full flex-1 bg-transparent text-[14.5px] font-medium text-[#fafafa] outline-none placeholder:text-[#71717a]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="flex shrink-0 items-center text-[#a1a1aa] transition hover:text-[#fafafa]"
                type="button"
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>

          {!isSearching && visibleCategories.length > 0 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                type="button"
                onClick={() => setActiveCat("all")}
                className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  effectiveCat === "all"
                    ? "bg-[#fb923c] text-[#1a1a1a]"
                    : "border border-[#27272a] bg-[#18181b] text-[#d4d4d8]"
                }`}
              >
                Todos
              </button>
              {visibleCategories.map((cat) => {
                const active = cat.id === effectiveCat
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCat(cat.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                      active
                        ? "bg-[#fb923c] text-[#1a1a1a]"
                        : "border border-[#27272a] bg-[#18181b] text-[#d4d4d8]"
                    }`}
                  >
                    {cat.category_name}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* ── Listado ── */}
        <div className="flex-1 px-4 pt-4">
          {isSearching && (
            <p className="mb-3.5 text-[13px] text-[#a1a1aa]">
              {displayedProducts.length} resultado{displayedProducts.length !== 1 ? "s" : ""} para “{searchQuery.trim()}”
            </p>
          )}

          {displayedProducts.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {displayedProducts.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  isPopular={recommendations.some((r) => r.id === item.id)}
                  onOpenDetail={setDetailProduct}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <svg className="h-7 w-7 text-[#52525b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="mt-1 text-base font-bold text-[#fafafa]">
                {isSearching ? "Sin coincidencias" : "Aun no hay productos disponibles"}
              </p>
              <p className="text-[13px] text-[#71717a]">
                {isSearching ? "Prueba con otro plato o revisa las categorias." : "Vuelve a intentarlo más tarde."}
              </p>
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-3 rounded-full bg-[#fb923c] px-4 py-2 text-xs font-extrabold text-[#1a1a1a] transition active:scale-95"
                >
                  Limpiar busqueda
                </button>
              )}
            </div>
          )}

          <div className="h-6" />
        </div>
      </section>

      {restaurant && tableId ? (
        <FloatingCartButton tableId={tableId} restaurantId={restaurant.id} />
      ) : null}

      {detailProduct ? (
        <ProductDetailSheet
          product={detailProduct}
          tableId={tableId ?? null}
          restaurantId={restaurant?.id ?? null}
          onClose={() => setDetailProduct(null)}
          onAdded={(name) => setToast(`${name} agregado`)}
        />
      ) : null}

      {toast && (
        <div className="animate-toast-in fixed bottom-[88px] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#3f3f46] bg-[#27272a] px-[18px] py-[11px] text-[13.5px] font-semibold text-[#fafafa] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          {toast}
        </div>
      )}

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
