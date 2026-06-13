// Animación "fly to cart": cuando el usuario toca "Añadir al carrito",
// la imagen del producto se duplica, achica y vuela hacia el botón del carrito.

import { getImageHasBackground } from "@/lib/customer/image-bg"

const CART_TARGET_ID = "fly-to-cart-target"

export function getCartTargetId(): string {
  return CART_TARGET_ID
}

export function flyToCart(source: HTMLImageElement | HTMLElement | null): void {
  if (typeof window === "undefined") return
  if (!source) return

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return

  const target = document.getElementById(CART_TARGET_ID)
  if (!target) return

  const sRect = source.getBoundingClientRect()
  const tRect = target.getBoundingClientRect()

  const clone = source.cloneNode(true) as HTMLElement

  // Solo las imágenes CON fondo vuelan recortadas en círculo (cuadrado centrado
  // + borde redondo + cover). Los recortes transparentes vuelan completos: un
  // círculo con object-fit cover los cortaría.
  const src = source instanceof HTMLImageElement ? source.currentSrc || source.src : null
  const circular = getImageHasBackground(src)

  clone.style.position = "fixed"
  clone.style.margin = "0"
  clone.style.padding = "0"
  clone.style.zIndex = "9999"
  if (circular) {
    const size = Math.min(sRect.width, sRect.height)
    clone.style.left = `${sRect.left + (sRect.width - size) / 2}px`
    clone.style.top = `${sRect.top + (sRect.height - size) / 2}px`
    clone.style.width = `${size}px`
    clone.style.height = `${size}px`
    clone.style.borderRadius = "9999px"
    clone.style.overflow = "hidden"
    clone.style.objectFit = "cover"
  } else {
    clone.style.left = `${sRect.left}px`
    clone.style.top = `${sRect.top}px`
    clone.style.width = `${sRect.width}px`
    clone.style.height = `${sRect.height}px`
  }
  clone.style.pointerEvents = "none"
  clone.style.transformOrigin = "center"
  clone.style.willChange = "transform, opacity"
  clone.style.transition = "transform 650ms cubic-bezier(0.55, 0, 0.1, 1), opacity 650ms ease-out"

  document.body.appendChild(clone)

  void clone.offsetHeight

  const targetX = tRect.left + tRect.width / 2
  const targetY = tRect.top + tRect.height / 2
  const sourceX = sRect.left + sRect.width / 2
  const sourceY = sRect.top + sRect.height / 2

  clone.style.transform = `translate(${targetX - sourceX}px, ${targetY - sourceY}px) scale(0.12) rotate(20deg)`
  clone.style.opacity = "0.35"

  const cleanup = () => clone.remove()
  clone.addEventListener("transitionend", cleanup, { once: true })
  setTimeout(cleanup, 1000)

  target.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.18)", offset: 0.6 },
      { transform: "scale(1)" },
    ],
    { duration: 700, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
  )
}
