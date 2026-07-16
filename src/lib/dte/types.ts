// Tipos del dominio DTE (documentos tributarios electrónicos), independientes
// del proveedor. La app habla en estos términos; cada adaptador traduce a la
// API concreta (LibreDTE, SimpleAPI o SII directo).

export type DteType = "boleta" | "factura" | "nota_credito"

/** Código de documento del SII por tipo. */
export const DTE_SII_CODE: Record<DteType, number> = {
  boleta: 39,
  factura: 33,
  nota_credito: 61,
}

/** Etiqueta legible por código SII (para UI). */
export const DTE_LABEL_BY_CODE: Record<number, string> = {
  33: "Factura electrónica",
  34: "Factura exenta",
  39: "Boleta electrónica",
  41: "Boleta exenta",
  56: "Nota de débito",
  61: "Nota de crédito",
}

/** Estado del documento en el ciclo SII. */
export type DteSiiStatus = "pending" | "accepted" | "rejected" | "error"

export type DteReceptor = {
  rut?: string | null
  razonSocial?: string | null
  giro?: string | null
  direccion?: string | null
}

export type DteEmisor = {
  rut: string
  razonSocial: string
}

export type DteEmitInput = {
  type: DteType
  net: number
  iva: number
  total: number
  emisor: DteEmisor
  receptor?: DteReceptor
  /** Referencia al documento original (para notas de crédito). */
  reference?: { docType: DteType; folio: number }
}

/** Resultado de una emisión (o de una consulta de estado). */
export type DteAdapterResult = {
  status: DteSiiStatus
  folio?: number | null
  trackId?: string | null
  pdfUrl?: string | null
  xmlUrl?: string | null
  error?: string | null
}
