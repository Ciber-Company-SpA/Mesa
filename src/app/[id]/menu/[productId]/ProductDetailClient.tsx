"use client"

import { useRef, useState } from "react"
import { decodeId } from "@/lib/hashids"
import { useProductDetail } from "@/hooks/useProductDetail"
import { useProductVariants } from "@/hooks/useProductVariants"
import { useCartSync } from "@/hooks/useCartSync"
import { useTableCart } from "@/hooks/useTableCart"
import { BackButton } from "@/components/ui/BackButton"
import { flyToCart } from "@/lib/customer/fly-to-cart"
import type { MenuData } from "@/types/menu"

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

function DetailMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9e6e1] px-4 text-stone-900">
      <div className="rounded-2xl border border-stone-200 bg-white px-6 py-5 text-center text-sm font-bold shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </main>
  )
}

export function ProductDetailClient({
  productId,
  menu,
}: {
  productId: string
  menu: MenuData
}) {
  const realProductId = decodeId(productId)
  const { restaurant, tableId, products } = menu
  const menuProduct = products.find((item) => item.id === realProductId)
  const { product, loading, error } = useProductDetail(realProductId, menuProduct)
  const { variants, loading: loadingVariants, error: variantsError } = useProductVariants(
    realProductId,
    product?.product_variants ?? menuProduct?.product_variants
  )
  const [activeVariantIndex, setActiveVariantIndex] = useState(0)
  const [realtimeStatus, setRealtimeStatus] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [message, setMessage] = useState("")
  const imageRef = useRef<HTMLImageElement | null>(null)

  const { syncCart } = useCartSync(product?.restaurant_id ?? null)
  const { addItem } = useTableCart(tableId ?? null, product?.restaurant_id ?? null)

  if (!realProductId) return <DetailMessage>Producto no encontrado</DetailMessage>
  if (loading) return <DetailMessage>Cargando producto...</DetailMessage>
  if (error || !product) return <DetailMessage>{error || "Producto no encontrado"}</DetailMessage>
  if (restaurant && product.restaurant_id !== restaurant.id) {
    return <DetailMessage>Producto no encontrado</DetailMessage>
  }

  const activeVariant = variants[Math.min(activeVariantIndex, variants.length - 1)] ?? null
  const activePrice = activeVariant?.variant_price ?? product.product_price
  const activeImage = activeVariant?.variant_image ?? product.product_image
  const currentStatus = realtimeStatus ?? product.status_id
  const unavailable = currentStatus === 2 || currentStatus === 3
  const currentProductId = product.id

  async function handleAddToCart() {
    if (unavailable || !tableId) return

    setIsAdding(true)
    try {
      await syncCart()
      const response = await fetch(`/api/product-status?id=${currentProductId}`)
      const status = await response.json()

      if (!status || status.status_id === 2 || status.status_id === 3) {
        setRealtimeStatus(status?.status_id ?? 2)
        setMessage(status?.status_id === 3 ? "Producto no disponible" : "Producto agotado")
        window.setTimeout(() => setMessage(""), 3000)
        return
      }

      flyToCart(imageRef.current)
      await addItem({
        productId: currentProductId,
        variantId: activeVariant?.id ?? null,
        price: activePrice,
        quantity: 1,
      })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#e9e6e1] font-[family-name:var(--font-manrope)] text-stone-900 sm:py-4">
      <section className="relative mx-auto min-h-screen w-full overflow-hidden bg-[#f5f5f4] pb-28 shadow-[0_30px_80px_rgba(38,27,18,0.12)] sm:min-h-[calc(100vh-32px)] sm:max-w-[384px] sm:rounded-[38px] sm:border-[10px] sm:border-[#e7e5e1]">
        <div
          className="relative h-[320px] bg-[#f4f4f3]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(0,0,0,0.02) 0 11px, transparent 11px 23px)",
          }}
        >
          <BackButton
            label="‹"
            className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-3xl font-light text-stone-700 ring-1 ring-black/5 backdrop-blur"
          />

          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={activeImage}
              alt={activeVariant?.variant_name ?? product.product_name}
              className="h-full w-full object-contain p-5"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-stone-400">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
              </svg>
              <span className="mt-2 text-xs">Foto del plato</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f5f5f4] to-transparent" />
        </div>

        <div className="-mt-3 px-5 pb-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-600">
              {product.categories?.category_name ?? "Producto"}
            </span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
              Recomendado
            </span>
          </div>

          <h1 className="mt-4 font-[family-name:var(--font-grotesk)] text-[29px] font-bold leading-[1.05] tracking-[-0.04em]">
            {product.product_name}
          </h1>

          {product.product_description ? (
            <p className="mt-4 text-[14px] leading-6 text-stone-500">
              {product.product_description}
            </p>
          ) : null}

          {variants.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-stone-400">
                Elige una opcion
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                {variants.map((variant, index) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setActiveVariantIndex(index)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                      index === activeVariantIndex
                        ? "bg-[#ff5b16] text-white"
                        : "border border-stone-200 bg-white text-stone-600"
                    }`}
                  >
                    {variant.variant_name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex items-center justify-between rounded-[22px] border border-stone-200 bg-white p-5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-stone-400">
                Precio
              </p>
              <p className="mt-1 font-[family-name:var(--font-grotesk)] text-[28px] font-bold text-[#ff5b16]">
                {formatPrice(activePrice)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={unavailable || isAdding}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff5b16] text-3xl font-light text-white shadow-[0_8px_18px_rgba(255,91,22,0.35)] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
              aria-label={`Agregar ${product.product_name}`}
            >
              +
            </button>
          </div>

          {loadingVariants ? (
            <p className="mt-4 text-center text-xs font-bold text-stone-400">Cargando opciones...</p>
          ) : null}
          {variantsError ? (
            <p className="mt-4 text-center text-xs font-bold text-red-500">{variantsError}</p>
          ) : null}
          {message ? (
            <p className="mt-4 text-center text-xs font-bold text-red-500">{message}</p>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full bg-gradient-to-t from-[#f5f5f4] via-[#f5f5f4] to-transparent px-5 pb-4 pt-10 sm:bottom-4 sm:max-w-[384px]">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={unavailable || isAdding}
            className="h-[54px] w-full rounded-[15px] bg-[#ff5b16] text-[15px] font-extrabold text-white shadow-[0_12px_28px_rgba(255,91,22,0.28)] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            {isAdding
              ? "Agregando..."
              : currentStatus === 2
                ? "Agotado"
                : currentStatus === 3
                  ? "No disponible"
                  : "Anadir al carrito"}
          </button>
        </div>
      </section>
    </main>
  )
}
