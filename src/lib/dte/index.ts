import type { DteAdapter } from "./adapter"
import { SimulatedDteAdapter } from "./adapters/simulated"
import { LibreDteAdapter } from "./adapters/libredte"

/**
 * Selecciona el adaptador de DTE según la variable de entorno DTE_PROVIDER.
 * Default: simulado. `libredte` activa el proveedor real (requiere LIBREDTE_HASH
 * y, opcional, LIBREDTE_URL para API Gateway) — validar en certificación antes
 * de producción. Agregar otro proveedor = un adaptador + un case, sin tocar
 * el servicio ni la UI.
 */
export function getDteAdapter(): DteAdapter {
  const provider = process.env.DTE_PROVIDER ?? "simulated"
  switch (provider) {
    case "libredte":
      return new LibreDteAdapter()
    // case "simpleapi": return new SimpleApiAdapter()  // futuro
    case "simulated":
    default:
      return new SimulatedDteAdapter()
  }
}

/** True si el proveedor activo es el simulado (para avisos en la UI). */
export function isDteSimulated(): boolean {
  return (process.env.DTE_PROVIDER ?? "simulated") === "simulated"
}

export * from "./types"
export type { DteAdapter } from "./adapter"
