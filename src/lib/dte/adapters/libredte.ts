import type { DteAdapter } from "../adapter"
import type { DteEmitInput, DteAdapterResult } from "../types"
import { DTE_SII_CODE } from "../types"

/**
 * Adaptador REAL de LibreDTE, modelado sobre el cliente oficial
 * `LibreDTE/libredte-api-client-php` (verificado):
 *  - Base: LIBREDTE_URL (default https://libredte.cl) + `/api`.
 *  - Auth: HTTP Basic con el hash como usuario y "X" como password
 *    → Authorization: Basic base64(hash:X). El hash es el token del usuario.
 *  - Flujo de emisión:
 *      1) POST /api/dte/documentos/emitir  → DTE temporal {receptor, dte, codigo}
 *      2) POST /api/dte/documentos/generar → DTE real (firma + envío al SII)
 *  - Estado del SII: por polling (no webhooks) → checkStatus().
 *
 * Multi-emisor: el RUT emisor va en cada request (Encabezado.Emisor.RUTEmisor);
 * el certificado + CAF del emisor se configuran en la cuenta del proveedor
 * (LibreDTE / API Gateway). Para usar API Gateway (apigateway.cl) basta cambiar
 * LIBREDTE_URL y el hash; el contrato de la API es el mismo.
 *
 * IMPORTANTE: el mapeo tributario (Detalle desde el total, IVA de boleta vs
 * factura) y el endpoint exacto de estado se VALIDAN contra el ambiente de
 * CERTIFICACIÓN antes de producción. No emitir en producción sin ese paso.
 */

const DEFAULT_URL = "https://libredte.cl"

function config() {
  const hash = process.env.LIBREDTE_HASH?.trim() || ""
  const base = (process.env.LIBREDTE_URL?.trim() || DEFAULT_URL).replace(/\/+$/, "")
  return { hash, api: `${base}/api` }
}

function authHeader(hash: string): string {
  return "Basic " + Buffer.from(`${hash}:X`).toString("base64")
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isFinite(n) ? n : null
}
function str(v: unknown): string | null {
  return v == null ? null : String(v)
}
function apiError(body: unknown, httpStatus: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>
    const m = b.message ?? b.error ?? b.glosa
    if (typeof m === "string") return m
  }
  if (typeof body === "string" && body) return body
  return `HTTP ${httpStatus}`
}

/** Traduce nuestro input al JSON DTE del SII (estructura del cliente oficial). */
function buildDteJson(input: DteEmitInput): Record<string, unknown> {
  const encabezado: Record<string, unknown> = {
    IdDoc: { TipoDTE: DTE_SII_CODE[input.type] },
    Emisor: { RUTEmisor: input.emisor.rut },
  }
  if (input.receptor?.rut) {
    encabezado.Receptor = {
      RUTRecep: input.receptor.rut,
      ...(input.receptor.razonSocial ? { RznSocRecep: input.receptor.razonSocial } : {}),
      ...(input.receptor.giro ? { GiroRecep: input.receptor.giro } : {}),
      ...(input.receptor.direccion ? { DirRecep: input.receptor.direccion } : {}),
    }
  }

  // El sistema no maneja line items: se emite una línea desde el total.
  // Factura (33): precio = neto (LibreDTE agrega IVA 19%).
  // Boleta (39): precio = total (IVA incluido).
  const precio = input.type === "boleta" ? input.total : input.net
  const dte: Record<string, unknown> = {
    Encabezado: encabezado,
    Detalle: [{ NmbItem: "Consumo", QtyItem: 1, PrcItem: precio }],
  }

  // Nota de crédito: bloque Referencia al documento original.
  if (input.type === "nota_credito" && input.reference) {
    dte.Referencia = [
      {
        TpoDocRef: DTE_SII_CODE[input.reference.docType],
        FolioRef: input.reference.folio,
        CodRef: 1, // 1 = anula; ajustar (2 corrige texto / 3 corrige montos) según motivo
        RazonRef: "Anula documento",
      },
    ]
  }
  return dte
}

export class LibreDteAdapter implements DteAdapter {
  readonly name = "libredte"

  async emit(input: DteEmitInput): Promise<DteAdapterResult> {
    const { hash, api } = config()
    if (!hash) return { status: "error", error: "Falta LIBREDTE_HASH (token de LibreDTE)" }
    const headers = {
      Authorization: authHeader(hash),
      "content-type": "application/json",
      accept: "application/json",
    }

    try {
      // 1) DTE temporal. normalizar=1: LibreDTE completa y cuadra los montos
      // (IVA, totales) desde el Detalle — clave porque emitimos una línea.
      const emitirRes = await fetch(`${api}/dte/documentos/emitir?normalizar=1&formato=json&links=0&email=0`, {
        method: "POST",
        headers,
        body: JSON.stringify(buildDteJson(input)),
        signal: AbortSignal.timeout(30_000),
      })
      const temp = (await emitirRes.json().catch(() => null)) as Record<string, unknown> | null
      if (!emitirRes.ok || !temp) {
        return { status: "error", error: `LibreDTE (emitir): ${apiError(temp, emitirRes.status)}` }
      }

      // 2) DTE real (firma + envío al SII). retry: reintentos internos del
      // proveedor contra el SII antes de responder.
      const genRes = await fetch(`${api}/dte/documentos/generar?getXML=0&links=0&email=0&retry=10`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          emisor: input.emisor.rut,
          receptor: temp.receptor,
          dte: temp.dte,
          codigo: temp.codigo,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      const real = (await genRes.json().catch(() => null)) as Record<string, unknown> | null
      if (!genRes.ok || !real) {
        return { status: "error", error: `LibreDTE (generar): ${apiError(real, genRes.status)}` }
      }

      const folio = num(real.folio ?? (real as Record<string, unknown>).Folio)
      // trackId compuesto: el estado SII se consulta por (emisor, dte, folio).
      const dteCode = num(real.dte ?? DTE_SII_CODE[input.type]) ?? DTE_SII_CODE[input.type]
      const trackId = folio ? `${input.emisor.rut}:${dteCode}:${folio}` : null

      // Recién enviado, el SII suele quedar en trámite → pending (se resuelve por polling).
      return { status: "pending", folio, trackId, pdfUrl: null, xmlUrl: null }
    } catch {
      return { status: "error", error: "No se pudo contactar a LibreDTE (red/timeout)" }
    }
  }

  async checkStatus(trackId: string): Promise<DteAdapterResult> {
    const { hash, api } = config()
    if (!hash) return { status: "error", error: "Falta LIBREDTE_HASH" }
    const parts = trackId.split(":")
    if (parts.length < 3) return { status: "pending", trackId }
    const [emisor, dte, folio] = parts

    try {
      // Consulta/actualiza el estado del envío ante el SII (endpoint validado en certificación).
      const res = await fetch(
        `${api}/dte/dte_emitidos/actualizar_estado/${dte}/${folio}/${emisor}?usarWebservice=1`,
        {
          method: "GET",
          headers: { Authorization: authHeader(hash), accept: "application/json" },
          signal: AbortSignal.timeout(30_000),
        }
      )
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok || !body) {
        return { status: "pending", trackId, error: apiError(body, res.status) }
      }
      const estado = String(body.revision_estado ?? body.estado ?? "").toUpperCase()
      if (estado.includes("ACEPT")) return { status: "accepted", trackId, folio: num(folio) }
      if (estado.includes("RECHAZ")) return { status: "rejected", trackId, folio: num(folio) }
      return { status: "pending", trackId, folio: num(folio) }
    } catch {
      return { status: "pending", trackId, error: "No se pudo contactar a LibreDTE (red/timeout)" }
    }
  }

  /**
   * PDF oficial (representación impresa con timbre PDF417 real).
   * La doc pública muestra /api/dte_emitidos/pdf y el módulo Dte expone
   * /api/dte/dte_emitidos/pdf — se intentan ambas rutas (fallback).
   */
  async getPdf(trackId: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
    const { hash, api } = config()
    if (!hash) return null
    const parts = trackId.split(":")
    if (parts.length < 3) return null
    const [emisor, dte, folio] = parts

    const paths = [
      `${api}/dte/dte_emitidos/pdf/${dte}/${folio}/${emisor}?formato=general&papelContinuo=0`,
      `${api}/dte_emitidos/pdf/${dte}/${folio}/${emisor}?formato=general&papelContinuo=0`,
    ]
    for (const url of paths) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: authHeader(hash) },
          signal: AbortSignal.timeout(30_000),
        })
        const contentType = res.headers.get("content-type") ?? ""
        if (res.ok && contentType.includes("pdf")) {
          return { data: await res.arrayBuffer(), contentType: "application/pdf" }
        }
      } catch {
        // probar la siguiente ruta
      }
    }
    return null
  }
}
