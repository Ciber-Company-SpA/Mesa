import type { DteAdapter } from "../adapter"
import type { DteEmitInput, DteAdapterResult } from "../types"

/**
 * Adaptador SIMULADO. NO emite documentos válidos ante el SII: genera folio y
 * track id ficticios y responde "aceptado" para poder validar el flujo completo
 * (emisión → registro → consulta de estado → UI) sin credenciales ni proveedor.
 *
 * Los documentos simulados se reconocen por el prefijo "SIM-" en el track id.
 * Cuando haya credenciales de sandbox, se agrega el adaptador real y se
 * selecciona con la variable DTE_PROVIDER; este queda como respaldo/desarrollo.
 */
export class SimulatedDteAdapter implements DteAdapter {
  readonly name = "simulated"

  async emit(_input: DteEmitInput): Promise<DteAdapterResult> {
    const trackId = `SIM-${crypto.randomUUID()}`
    // Folio ficticio de 6 dígitos (no corresponde a un CAF real).
    const folio = 100000 + Math.floor(Math.random() * 900000)
    // Sin archivos externos: el documento simulado lo renderiza la propia app
    // (vista previa imprimible). El adaptador real sí devolverá pdfUrl/xmlUrl.
    return {
      status: "accepted",
      folio,
      trackId,
      pdfUrl: null,
      xmlUrl: null,
      error: null,
    }
  }

  async checkStatus(_trackId: string): Promise<DteAdapterResult> {
    // En simulación un documento aceptado se mantiene aceptado.
    return { status: "accepted", error: null }
  }
}
