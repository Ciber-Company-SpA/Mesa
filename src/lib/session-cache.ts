import { invalidateCache } from "@/hooks/useCache"

/**
 * Prefijos de cache scopeados por usuario/restaurante. Cuando se hace login,
 * logout o cambio de cuenta hay que limpiar estos para evitar mostrar datos
 * de la sesión anterior (otro restaurante, otro rol, etc.).
 */
const USER_SCOPED_CACHE_PREFIXES = [
  "admin-profile",
  "staff-profile",
  "restaurant-id",
  "restaurant-",
  "categories-",
  "categories-all-",
  "tables-",
  "products-",
  "product-",
  "product-variants-",
  "orders-",
  "order-stats-",
  "waiters-list",
]

export function clearUserScopedCache(): void {
  for (const prefix of USER_SCOPED_CACHE_PREFIXES) {
    invalidateCache(`${prefix}:*`)
  }
}
