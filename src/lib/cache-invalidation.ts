import { invalidateCache } from "@/hooks/useCache"

// Helpers para invalidar los caches client-side después de mutaciones.
// Usar el wildcard ":*" hace que invalidateCache aplique a TODAS las claves
// que empiezan con el prefijo (cubre paginación, distintos restaurantIds, etc).

export function invalidateCategoryCaches() {
  invalidateCache("categories-:*")
}

export function invalidateProductCaches() {
  // "product-:*" cubre también "products-..." y "product-variants-..." porque
  // todos empiezan con "product-".
  invalidateCache("product-:*")
}

export function invalidateTableCaches() {
  invalidateCache("tables-:*")
}

export function invalidateWaiterCaches() {
  invalidateCache("waiters-list")
}

export function invalidateOrderCaches() {
  invalidateCache("orders-:*")
  invalidateCache("order-stats-:*")
}
