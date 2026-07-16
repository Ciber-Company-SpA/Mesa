import type { DteAdapter } from "./adapter"
import { SimulatedDteAdapter } from "./adapters/simulated"

/**
 * Selecciona el adaptador de DTE según la variable de entorno DTE_PROVIDER.
 * Hoy solo existe el simulado (default). Al integrar un proveedor real se
 * agrega su adaptador y su case aquí, sin tocar el servicio ni la UI.
 */
export function getDteAdapter(): DteAdapter {
  const provider = process.env.DTE_PROVIDER ?? "simulated"
  switch (provider) {
    // case "libredte":  return new LibreDteAdapter()   // futuro (API Gateway)
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
