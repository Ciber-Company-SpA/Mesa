/**
 * Mapa ruta → clave de módulo del registro platform_modules (portal
 * Plataforma). Lo usan el sidebar del admin (ocultar navegación) y
 * ModuleGate (bloqueo duro por URL directa).
 */

export const ADMIN_MODULE_BY_ROUTE: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/categories": "categories",
  "/admin/products": "products",
  "/admin/inventory": "inventory",
  "/admin/tables": "tables",
  "/admin/reservations": "reservations",
  "/admin/orders": "orders",
  "/admin/waiters": "waiters",
  "/admin/reports": "reports",
  "/admin/printer": "printer",
  "/screen": "screen",
  "/admin/settings": "settings",
  "/admin/plan": "plan",
  "/admin/pagos": "pagos",
  "/admin/api": "api",
  "/admin/soporte": "soporte",
  "/admin/instalar": "instalar",
  "/admin/sucursales": "sucursales",
}

export const WAITER_MODULE_BY_ROUTE: Record<string, string> = {
  "/waiter/control": "control",
  "/waiter/caja": "caja",
  "/waiter/soporte": "soporte",
}

/**
 * Resuelve la clave de módulo para un pathname por prefijo más largo
 * ("/admin/products/123" → products). "/admin" solo matchea exacto para no
 * tragarse todas las subrutas.
 */
export function resolveModuleKey(
  area: "admin" | "waiter",
  pathname: string
): string | null {
  const map = area === "admin" ? ADMIN_MODULE_BY_ROUTE : WAITER_MODULE_BY_ROUTE
  let best: string | null = null
  let bestLen = 0
  for (const [route, key] of Object.entries(map)) {
    const exact = pathname === route
    const prefix = route !== "/admin" && pathname.startsWith(route + "/")
    if ((exact || prefix) && route.length > bestLen) {
      best = key
      bestLen = route.length
    }
  }
  return best
}
