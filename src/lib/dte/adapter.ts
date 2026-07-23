import type { DteEmitInput, DteAdapterResult } from "./types"

/**
 * Contrato que debe cumplir cualquier proveedor de DTE. La app solo depende de
 * esta interfaz; cambiar de proveedor (o pasar a conexión directa al SII) es
 * implementar otro adaptador, sin tocar el resto del sistema.
 */
export interface DteAdapter {
  /** Identificador del proveedor (queda trazable en logs/documentos). */
  readonly name: string

  /** Emite un documento. Puede resolver de inmediato ('accepted'/'rejected')
   *  o quedar 'pending' con un trackId para consultar después. */
  emit(input: DteEmitInput): Promise<DteAdapterResult>

  /** Consulta el estado de un documento en trámite (el SII responde por
   *  polling, no webhooks; por eso el worker de estado usa este método). */
  checkStatus(trackId: string): Promise<DteAdapterResult>

  /** PDF oficial del documento (representación impresa con timbre) si el
   *  proveedor lo genera. null = no disponible (la app usa su vista HTML). */
  getPdf?(trackId: string): Promise<{ data: ArrayBuffer; contentType: string } | null>
}
