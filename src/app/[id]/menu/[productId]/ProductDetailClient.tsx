"use client"

import { useTableCart } from "@/hooks/useTableCart"
import { useEffect, useRef, useState } from "react"
import { decodeId } from "@/lib/hashids"
import { useProductDetail } from "@/hooks/useProductDetail"
import { useProductVariants } from "@/hooks/useProductVariants"
import { FloatingCartButton } from "@/components/customer/FloatingCartButton"
import { TableOrdersHeader } from "@/components/customer/TableOrdersHeader"
import { useCartSync } from "@/hooks/useCartSync"
import { BackButton } from "@/components/ui/BackButton"
import { useLastOrder } from "@/hooks/useLastOrder"
import { getTemplateDesign } from "@/lib/menu/templates"
import { flyToCart } from "@/lib/customer/fly-to-cart"
import type { MenuData } from "@/types/menu"

function formatPrice(price: number) {
  return `$${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
}

export function ProductDetailClient({
  productId,
  menu,
}: {
  productId: string
  menu: MenuData
}) {
  const [activeOptionIndex, setActiveOptionIndex] = useState(0)
  const [unavailableMsg, setUnavailableMsg] = useState("")
  const [realtimeStatus, setRealtimeStatus] = useState<number | null>(null)
  const [isSliding, setIsSliding] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  const sliderRef = useRef<HTMLDivElement | null>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isProgrammaticScrollRef = useRef(false)

  const realProductId = decodeId(productId)
  const { restaurant, tableId, products } = menu
  const design = getTemplateDesign(restaurant?.menu_template)
  const menuProduct = products.find((item) => item.id === realProductId)
  const { product, loading, error } = useProductDetail(realProductId, menuProduct)
  const { activeOrder, syncOrder } = useLastOrder()

  const {
    variants,
    loading: loadingVariants,
    error: variantsError,
  } = useProductVariants(realProductId, product?.product_variants ?? menuProduct?.product_variants)

  const { syncCart } = useCartSync(product?.restaurant_id ?? null)
  const { addItem } = useTableCart(tableId ?? null, product?.restaurant_id ?? null)

  useEffect(() => {
    if (!activeOrder) return
    syncOrder(activeOrder)
  }, [activeOrder, syncOrder])

  if (!realProductId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4 text-white">
        <div className="rounded-[2rem] bg-red-500/10 px-6 py-5 text-center shadow-2xl shadow-black/30 ring-1 ring-red-300/20 backdrop-blur">
          <p className="text-sm font-semibold text-red-100">
            Producto no encontrado
          </p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 text-white">
        <div className="rounded-[2rem] bg-white/10 px-6 py-5 text-center shadow-2xl shadow-black/30 ring-1 ring-white/10 backdrop-blur">
          <p className="text-sm font-semibold text-orange-100">
            Cargando producto...
          </p>
        </div>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4 text-white">
        <div className="rounded-[2rem] bg-red-500/10 px-6 py-5 text-center shadow-2xl shadow-black/30 ring-1 ring-red-300/20 backdrop-blur">
          <p className="text-sm font-semibold text-red-100">
            {error || "Producto no encontrado"}
          </p>
        </div>
      </main>
    )
  }

  // Seguridad: el producto debe pertenecer al mismo restaurante que el menu
  // escaneado. Sin esto, un QR de un restaurante mostraría productos de otro
  // si se manipula el hashid del producto en la URL.
  if (restaurant && product.restaurant_id !== restaurant.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 px-4 text-white">
        <div className="rounded-[2rem] bg-red-500/10 px-6 py-5 text-center shadow-2xl shadow-black/30 ring-1 ring-red-300/20 backdrop-blur">
          <p className="text-sm font-semibold text-red-100">
            Producto no encontrado
          </p>
        </div>
      </main>
    )
  }

  const currentStatus = realtimeStatus ?? product.status_id
  const isAgotado = currentStatus === 2
  const isDeshabilitado = currentStatus === 3

  const productOptions =
    variants.length > 0
      ? variants.map((variant) => ({
          id: variant.id,
          name: variant.variant_name,
          price: variant.variant_price,
          image: variant.variant_image,
        }))
      : [
          {
            id: product.id,
            name: product.product_name,
            price: product.product_price,
            image: product.product_image,
          },
        ]

  const activeOption =
    productOptions[Math.min(activeOptionIndex, productOptions.length - 1)]

  const activeTitle =
    variants.length > 0
      ? `${product.product_name} · ${activeOption.name}`
      : product.product_name

  const productIdForStatus = product.id
  const productNameForStatus = product.product_name
  const hasMultipleOptions = productOptions.length > 1

  function scrollToOption(index: number) {
    const slider = sliderRef.current
    if (!slider) return

    const safeIndex = Math.max(0, Math.min(productOptions.length - 1, index))
    const slide = slider.querySelector<HTMLElement>("[data-option-slide]")
    if (!slide) return

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    isProgrammaticScrollRef.current = true
    setIsSliding(true)

    slider.scrollTo({
      left: slide.offsetWidth * safeIndex,
      behavior: "smooth",
    })

    scrollTimeoutRef.current = setTimeout(() => {
      setActiveOptionIndex(safeIndex)
      isProgrammaticScrollRef.current = false
      setIsSliding(false)
    }, 420)
  }

  function handlePreviousOption() {
    scrollToOption(activeOptionIndex - 1)
  }

  function handleNextOption() {
    scrollToOption(activeOptionIndex + 1)
  }

  function handleOptionsScroll(event: React.UIEvent<HTMLDivElement>) {
    if (isProgrammaticScrollRef.current) return

    const scrollContainer = event.currentTarget
    const firstSlide =
      scrollContainer.querySelector<HTMLElement>("[data-option-slide]")

    if (!firstSlide) return

    const slideWidth = firstSlide.offsetWidth

    const nextIndex = Math.max(
      0,
      Math.min(
        productOptions.length - 1,
        Math.round(scrollContainer.scrollLeft / slideWidth)
      )
    )

    if (nextIndex !== activeOptionIndex) {
      setActiveOptionIndex(nextIndex)
    }
  }

  async function handleAddToCart() {
    if (isAgotado || isDeshabilitado) {
      setUnavailableMsg(
        isDeshabilitado
          ? `${productNameForStatus} no disponible`
          : `${productNameForStatus} agotado`
      )

      setTimeout(() => setUnavailableMsg(""), 3000)
      return
    }

    setIsAddingToCart(true)
    try {
      await syncCart()

      const res = await fetch(`/api/product-status?id=${productIdForStatus}`)
      const data = await res.json()

      if (!data || data.status_id === 2 || data.status_id === 3) {
        setRealtimeStatus(data.status_id)

        setUnavailableMsg(
          data?.status_id === 3
            ? `${productNameForStatus} no disponible`
            : `${productNameForStatus} agotado`
        )

        setTimeout(() => setUnavailableMsg(""), 3000)
        return
      }

      const slides = sliderRef.current?.querySelectorAll<HTMLElement>("[data-option-slide]")
      const activeSlide = slides?.[activeOptionIndex] ?? null
      const sourceImg = activeSlide?.querySelector<HTMLImageElement>("img")
      flyToCart(sourceImg ?? activeSlide)

      await addItem({
        productId: productIdForStatus,
        variantId: variants.length > 0 ? activeOption.id : null,
        price: activeOption.price,
        quantity: 1,
      })
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <main className={`min-h-screen overflow-hidden pb-28 ${design.mainClass}`}>
      <div className={`pointer-events-none fixed inset-0 ${design.overlayClass}`} />

      <div
        className={`fixed bottom-28 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
          unavailableMsg
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <div className="rounded-2xl bg-stone-900 px-5 py-3 text-sm font-black text-red-300 shadow-2xl ring-1 ring-white/10">
          {unavailableMsg}
        </div>
      </div>

      <section className="relative mx-auto max-w-md px-4 pb-6 pt-5 md:max-w-2xl md:px-6 lg:max-w-3xl">
        <TableOrdersHeader tableId={tableId ?? null} />

        <BackButton
          label="Volver al menú"
          className="mb-6 inline-flex items-center rounded-full bg-white/10 px-5 py-3 text-sm font-black text-orange-100 shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/[0.14] hover:text-orange-200"
        />

        <div className="relative">
          {hasMultipleOptions && (
            <>
              <button
                type="button"
                onClick={handlePreviousOption}
                disabled={activeOptionIndex === 0 || isSliding}
                className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/5 border border-white/10 text-stone-300 shadow-md backdrop-blur-sm transition-all duration-300 hover:bg-white/15 hover:text-white active:scale-90 disabled:pointer-events-none disabled:opacity-0"
                aria-label="Ver opción anterior"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleNextOption}
                disabled={activeOptionIndex === productOptions.length - 1 || isSliding}
                className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/5 border border-white/10 text-stone-300 shadow-md backdrop-blur-sm transition-all duration-300 hover:bg-white/15 hover:text-white active:scale-90 disabled:pointer-events-none disabled:opacity-0"
                aria-label="Ver siguiente opción"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <div
            ref={sliderRef}
            className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onScroll={handleOptionsScroll}
          >
            {productOptions.map((option) => (
              <div
                key={option.id}
                data-option-slide
                className="relative flex aspect-[1.6] max-h-[250px] w-full shrink-0 snap-center items-center justify-center overflow-hidden rounded-[2.25rem] md:aspect-[4/3]"
              >
                <div className="absolute inset-x-10 bottom-2 h-4 rounded-full bg-black/40 blur-lg" />

                {option.image ? (
                  <>
                    {/* Backdrop borroso de la misma imagen → halo de color que integra la foto al template */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={option.image}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 z-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl saturate-150"
                    />
                    {/* Imagen principal con máscara radial → bordes fundidos al fondo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={option.image}
                      alt={option.name}
                      className="relative z-10 h-full max-h-[230px] w-full object-contain p-2 drop-shadow-2xl transition-transform duration-300 hover:scale-[1.03] [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_92%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_92%)]"
                      loading="lazy"
                    />
                  </>
                ) : (
                  <div className="relative z-10 flex flex-col items-center text-center text-orange-100/80">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 text-3xl ring-1 ring-white/10">
                      +
                    </div>
                    <p className="mt-3 text-xs font-bold">Sin imagen</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {hasMultipleOptions && (
          <div className="mt-3 flex flex-col items-center gap-3">
            <p className="text-xs font-bold text-white/40">
              Desliza para ver más opciones
            </p>

            <div className="flex justify-center gap-2">
              {productOptions.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => scrollToOption(index)}
                  disabled={isSliding}
                  className={`h-2 rounded-full transition-all ${
                    index === activeOptionIndex
                      ? "w-8 bg-orange-300"
                      : "w-2 bg-white/25 hover:bg-white/40"
                  } disabled:pointer-events-none disabled:opacity-60`}
                  aria-label={`Ver opción ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 px-1">
          <p className="text-xs font-bold text-orange-200/80">
            {product.categories?.category_name}
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
            {activeTitle}
          </h1>

          {product.product_description && (
            <p className="mt-4 text-sm leading-6 text-stone-300">
              {product.product_description}
            </p>
          )}

          <div className="mt-7 flex justify-center">
            <div className="w-full rounded-[2.25rem] bg-white/5 p-6 text-center shadow-2xl shadow-black/40 border border-white/10 backdrop-blur-md ring-1 ring-white/5 transition-all hover:border-white/15">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-orange-300 border border-orange-500/20 shadow-sm">
                Precio del Producto
              </div>

              <p className="mt-3.5 text-4xl font-black tracking-tight text-orange-200 drop-shadow-[0_0_15px_rgba(251,146,60,0.3)] tabular-nums leading-none">
                {formatPrice(activeOption.price)}
              </p>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAgotado || isDeshabilitado || isAddingToCart}
                className={`mt-6 flex w-full items-center justify-center rounded-[1.35rem] px-5 py-4 text-sm font-black ring-1 transition duration-300 ease-out ${
                  isAgotado || isDeshabilitado || isAddingToCart
                    ? "cursor-not-allowed bg-stone-700 text-stone-400 ring-white/10 shadow-none"
                    : "bg-orange-500 text-stone-950 shadow-[0_8px_25px_rgba(249,115,22,0.3)] ring-orange-300/40 hover:bg-orange-400 hover:scale-[1.01] active:scale-[0.99] hover:shadow-[0_12px_30px_rgba(249,115,22,0.45)]"
                }`}
              >
                {isAddingToCart
                  ? "Agregando..."
                  : isAgotado
                  ? "Agotado"
                  : isDeshabilitado
                    ? "No disponible"
                    : "Añadir al carrito"}
              </button>
            </div>
          </div>

          {loadingVariants && variants.length === 0 && (
            <p className="mt-4 text-center text-sm font-semibold text-stone-300">
              Cargando opciones...
            </p>
          )}

          {variantsError && (
            <p className="mt-4 text-center text-sm font-semibold text-red-300">
              {variantsError}
            </p>
          )}
        </div>
      </section>

      {restaurant && tableId ? (
        <FloatingCartButton tableId={tableId} restaurantId={restaurant.id} />
      ) : null}
    </main>
  )
}
