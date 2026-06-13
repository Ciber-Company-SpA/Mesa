"use client"

import { useRef, useState } from "react"
import { useTableCart } from "@/hooks/useTableCart"
import { ProductImage } from "@/components/customer/ProductImage"
import { flyToCart } from "@/lib/customer/fly-to-cart"
import type { Product } from "@/types/product"

function formatPrice(price: number) {
  return `$${price.toLocaleString("es-CL")}`
}

type ProductDetailSheetProps = {
  product: Product
  tableId: number | null
  restaurantId: number | null
  onClose: () => void
  onAdded?: (name: string) => void
}

/**
 * Detalle de producto como bottom-sheet: entra deslizándose de abajo hacia
 * arriba sobre el menú, así el carrito flotante del menú sigue accesible.
 * Usa los datos ya cargados del menú (no hace fetch). La RPC de pedido valida
 * disponibilidad/precio server-side al confirmar.
 */
export function ProductDetailSheet({
  product,
  tableId,
  restaurantId,
  onClose,
  onAdded,
}: ProductDetailSheetProps) {
  const { addItem } = useTableCart(tableId, restaurantId)
  const variants = product.product_variants ?? []
  const [activeVariantIndex, setActiveVariantIndex] = useState(0)
  const [qty, setQty] = useState(1)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [closing, setClosing] = useState(false)

  const activeVariant = variants[Math.min(activeVariantIndex, variants.length - 1)] ?? null
  const activePrice = activeVariant?.variant_price ?? product.product_price
  const activeImage = activeVariant?.variant_image ?? product.product_image
  const isAgotado = product.status_id === 2

  // Cierre con animación de salida: dispara el slide-down + fade-out y recién
  // entonces desmonta (onClose) cuando termina.
  function requestClose() {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 260)
  }

  function handleAdd() {
    if (isAgotado || !tableId || !restaurantId) return
    flyToCart(imgRef.current)
    addItem({
      productId: product.id,
      variantId: activeVariant?.id ?? null,
      price: activePrice,
      quantity: qty,
    })
    onAdded?.(product.product_name)
    requestClose()
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-md ${
        closing ? "animate-overlay-fade-out" : "animate-overlay-fade"
      }`}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
    >
      <section
        className={`flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-[#0f0f10] text-[#fafafa] shadow-2xl shadow-black/50 sm:mb-4 sm:rounded-[28px] ${
          closing ? "animate-sheet-down" : "animate-sheet-up"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-[280px] shrink-0 overflow-hidden bg-[#0f0f10]">
          <ProductImage
            src={activeImage}
            alt={activeVariant?.variant_name ?? product.product_name}
            className="h-full w-full"
            imgRef={imgRef}
            hasBackground={!product.image_recortada}
            fade="bottom"
          />
          <button
            type="button"
            onClick={requestClose}
            className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-2xl font-light text-white backdrop-blur"
            aria-label="Volver"
          >
            ‹
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="mt-4 flex items-start justify-between gap-3">
            <h2 className="font-[family-name:var(--font-grotesk)] text-[24px] font-bold leading-[1.1] tracking-[-0.03em] text-[#fafafa]">
              {product.product_name}
            </h2>
            <span className="shrink-0 pt-1 font-[family-name:var(--font-grotesk)] text-[20px] font-extrabold text-[#fafafa]">
              {formatPrice(activePrice)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#27272a] bg-[#18181b] px-3 py-1 text-[11px] font-bold text-[#d4d4d8]">
              {product.categories?.category_name ?? "Producto"}
            </span>
            {isAgotado ? (
              <span className="rounded-full bg-[#dc2626] px-3 py-1 text-[11px] font-bold text-white">
                Agotado
              </span>
            ) : null}
          </div>

          {product.product_description ? (
            <p className="mt-4 text-[14px] leading-6 text-[#d4d4d8]">{product.product_description}</p>
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

        </div>

        <div className="shrink-0 border-t border-[#1f1f23] px-5 pb-5 pt-4">
          <div className="flex items-stretch gap-2.5">
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#27272a] bg-[#18181b] px-1.5">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={isAgotado}
                className="flex h-[52px] w-10 items-center justify-center rounded-full text-2xl font-light text-[#fafafa] disabled:opacity-40"
                aria-label="Quitar uno"
              >
                −
              </button>
              <span className="min-w-6 text-center text-base font-extrabold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                disabled={isAgotado}
                className="flex h-[52px] w-10 items-center justify-center rounded-full text-2xl font-light text-[#fafafa] disabled:opacity-40"
                aria-label="Agregar uno"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAgotado || !tableId}
              className="flex h-[52px] flex-1 items-center justify-center rounded-full bg-[#fb923c] text-[15px] font-extrabold text-[#1a1a1a] shadow-[0_12px_28px_rgba(251,146,60,0.25)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#27272a] disabled:text-[#52525b] disabled:shadow-none"
            >
              {isAgotado ? "Agotado" : `Agregar ${qty} — ${formatPrice(activePrice * qty)}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
