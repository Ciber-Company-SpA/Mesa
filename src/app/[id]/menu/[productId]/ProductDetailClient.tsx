"use client"

import { useRef, useState } from "react"
import { decodeId } from "@/lib/hashids"
import { useProductDetail } from "@/hooks/useProductDetail"
import { useProductVariants } from "@/hooks/useProductVariants"
import { useCartSync } from "@/hooks/useCartSync"
import { useTableCart } from "@/hooks/useTableCart"
import { BackButton } from "@/components/ui/BackButton"
import { ProductImage } from "@/components/customer/ProductImage"
import { flyToCart } from "@/lib/customer/fly-to-cart"
import type { MenuData } from "@/types/menu"

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

function DetailMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-[#fafafa]">
      <div className="rounded-2xl border border-[#27272a] bg-[#161618] px-6 py-5 text-center text-sm font-bold">
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
  const [qty, setQty] = useState(1)
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
        quantity: qty,
      })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <main className="min-h-screen bg-black font-[family-name:var(--font-manrope)] text-[#fafafa] sm:py-4">
      <section className="relative mx-auto min-h-screen w-full overflow-hidden bg-[#0f0f10] pb-28 shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:min-h-[calc(100vh-32px)] sm:max-w-[440px] sm:rounded-[38px] sm:border-[10px] sm:border-[#050506]">
        <div className="relative h-[300px] overflow-hidden bg-[#0f0f10]">
          <BackButton
            label="‹"
            className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-3xl font-light text-white backdrop-blur"
          />
          <ProductImage
            src={activeImage}
            alt={activeVariant?.variant_name ?? product.product_name}
            className="h-full w-full"
            imgRef={imageRef}
            fade="bottom"
          />
        </div>

        <div className="-mt-3 px-5 pb-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#27272a] bg-[#18181b] px-3 py-1 text-[11px] font-bold text-[#d4d4d8]">
              {product.categories?.category_name ?? "Producto"}
            </span>
          </div>

          <h1 className="mt-4 font-[family-name:var(--font-grotesk)] text-[29px] font-bold leading-[1.05] tracking-[-0.04em] text-[#fafafa]">
            {product.product_name}
          </h1>

          {product.product_description ? (
            <p className="mt-4 text-[14px] leading-6 text-[#d4d4d8]">
              {product.product_description}
            </p>
          ) : null}

          {variants.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#71717a]">
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
                        ? "bg-[#fb923c] text-[#1a1a1a]"
                        : "border border-[#27272a] bg-[#18181b] text-[#d4d4d8]"
                    }`}
                  >
                    {variant.variant_name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex items-center justify-between rounded-[22px] border border-[#27272a] bg-[#18181b] p-5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#71717a]">
                Precio
              </p>
              <p className="mt-1 font-[family-name:var(--font-grotesk)] text-[28px] font-bold text-[#fb923c]">
                {formatPrice(activePrice)}
              </p>
            </div>
          </div>

          {loadingVariants ? (
            <p className="mt-4 text-center text-xs font-bold text-[#71717a]">Cargando opciones...</p>
          ) : null}
          {variantsError ? (
            <p className="mt-4 text-center text-xs font-bold text-red-400">{variantsError}</p>
          ) : null}
          {message ? (
            <p className="mt-4 text-center text-xs font-bold text-red-400">{message}</p>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full bg-gradient-to-t from-[#0f0f10] via-[#0f0f10] to-transparent px-5 pb-4 pt-10 sm:bottom-4 sm:max-w-[440px]">
          <div className="flex items-stretch gap-2.5">
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#27272a] bg-[#18181b] px-1.5">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={unavailable}
                className="flex h-[54px] w-10 items-center justify-center rounded-full text-2xl font-light text-[#fafafa] disabled:opacity-40"
                aria-label="Quitar uno"
              >
                −
              </button>
              <span className="min-w-6 text-center text-base font-extrabold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                disabled={unavailable}
                className="flex h-[54px] w-10 items-center justify-center rounded-full text-2xl font-light text-[#fafafa] disabled:opacity-40"
                aria-label="Agregar uno"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={unavailable || isAdding}
              className="flex h-[54px] flex-1 items-center justify-center rounded-full bg-[#fb923c] text-[15px] font-extrabold text-[#1a1a1a] shadow-[0_12px_28px_rgba(251,146,60,0.25)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#27272a] disabled:text-[#52525b] disabled:shadow-none"
            >
              {isAdding
                ? "Agregando..."
                : currentStatus === 2
                  ? "Agotado"
                  : currentStatus === 3
                    ? "No disponible"
                    : `Agregar ${qty} · ${formatPrice(activePrice * qty)}`}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
