"use server"

import { requireCurrentAdmin } from "@/services/auth-guard"
import { getDteAdapter, DTE_SII_CODE, type DteType } from "@/lib/dte"
import { logger } from "@/lib/logger"
import { ok, fail, type Result } from "@/services/result"

export type TaxDocument = {
  id: number
  docType: number
  folio: number | null
  net: number | null
  iva: number | null
  total: number | null
  receptorRut: string | null
  receptorRazon: string | null
  receptorGiro: string | null
  receptorDir: string | null
  siiStatus: string
  trackId: string | null
  pdfUrl: string | null
  xmlUrl: string | null
  emittedAt: string | null
  createdAt: string
  simulated: boolean
}

type Row = {
  id: number
  doc_type: number
  folio: number | null
  net: number | null
  iva: number | null
  total: number | null
  receptor_rut: string | null
  receptor_razon: string | null
  receptor_giro: string | null
  receptor_dir: string | null
  sii_status: string
  track_id: string | null
  pdf_url: string | null
  xml_url: string | null
  emitted_at: string | null
  created_at: string
}

function mapRow(r: Row): TaxDocument {
  return {
    id: r.id,
    docType: r.doc_type,
    folio: r.folio,
    net: r.net,
    iva: r.iva,
    total: r.total,
    receptorRut: r.receptor_rut,
    receptorRazon: r.receptor_razon,
    receptorGiro: r.receptor_giro,
    receptorDir: r.receptor_dir,
    siiStatus: r.sii_status,
    trackId: r.track_id,
    pdfUrl: r.pdf_url,
    xmlUrl: r.xml_url,
    emittedAt: r.emitted_at,
    createdAt: r.created_at,
    simulated: (r.track_id ?? "").startsWith("SIM-"),
  }
}

export async function listTaxDocuments(): Promise<Result<TaxDocument[]>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase.rpc("get_my_tax_documents")
  if (error) return fail("No se pudieron cargar los documentos tributarios")
  return ok(((data ?? []) as Row[]).map(mapRow))
}

export type DteEmisorInfo = {
  rut: string
  razonSocial: string
  giro: string
  direccion: string
  comuna: string
  actividadEconomica: string
  logoUrl: string | null
}

/** Documento + datos del emisor, para renderizar la vista previa imprimible. */
export async function getDocumentForView(
  id: number
): Promise<Result<{ doc: TaxDocument; emisor: DteEmisorInfo }>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase.rpc("get_my_tax_documents")
  if (error) return fail("No se pudo cargar el documento")
  const row = ((data ?? []) as Row[]).find((r) => r.id === id)
  if (!row) return fail("Documento no encontrado")

  const { data: prof } = await supabase.rpc("get_my_tax_profile")
  const emisor: DteEmisorInfo = {
    rut: (prof?.rut as string) ?? "",
    razonSocial: (prof?.razon_social as string) ?? "",
    giro: (prof?.giro as string) ?? "",
    direccion: (prof?.direccion as string) ?? "",
    comuna: (prof?.comuna as string) ?? "",
    actividadEconomica: (prof?.actividad_economica as string) ?? "",
    logoUrl: (prof?.logo_url as string) ?? null,
  }
  return ok({ doc: mapRow(row), emisor })
}

export async function deleteDocument(id: number): Promise<Result<null>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { error } = await supabase.rpc("dte_delete_document", { p_id: id })
  if (error) return fail("No se pudo borrar el documento")
  return ok(null)
}

export type EmitInput = {
  type: DteType
  /** Monto total (con IVA) del documento. */
  total: number
  receptor?: { rut?: string; razonSocial?: string; giro?: string; direccion?: string }
  paymentId?: number | null
}

/**
 * Emite un documento a través del adaptador configurado (hoy el simulado) y lo
 * registra en tax_documents. Esta es la función que en el futuro llamará el
 * flujo de pago al confirmarse un cobro; hoy también se puede invocar para
 * validar el circuito con el adaptador simulado.
 */
export async function emitDocument(input: EmitInput): Promise<Result<{ id: number; status: string; folio: number | null }>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const total = Math.round(Number(input.total))
  if (!Number.isFinite(total) || total <= 0) return fail("Monto inválido")

  // Documento afecto: se desglosa el IVA (19%) desde el total.
  const net = Math.round(total / 1.19)
  const iva = total - net

  // Datos del emisor (restaurante) para el adaptador real; el simulado los ignora.
  const { data: prof } = await supabase.rpc("get_my_tax_profile")
  const emisor = {
    rut: (prof?.rut as string) ?? "",
    razonSocial: (prof?.razon_social as string) ?? "",
  }

  const adapter = getDteAdapter()
  let res
  try {
    res = await adapter.emit({
      type: input.type,
      net,
      iva,
      total,
      emisor,
      receptor: input.receptor
        ? {
            rut: input.receptor.rut ?? null,
            razonSocial: input.receptor.razonSocial ?? null,
            giro: input.receptor.giro ?? null,
            direccion: input.receptor.direccion ?? null,
          }
        : undefined,
    })
  } catch (err) {
    logger.error("Fallo al emitir DTE con el adaptador", err)
    return fail("No se pudo emitir el documento")
  }

  const { data: docId, error } = await supabase.rpc("dte_record_document", {
    p_doc_type: DTE_SII_CODE[input.type],
    p_net: net,
    p_iva: iva,
    p_total: total,
    p_receptor_rut: input.receptor?.rut ?? null,
    p_receptor_razon: input.receptor?.razonSocial ?? null,
    p_receptor_giro: input.receptor?.giro ?? null,
    p_receptor_dir: input.receptor?.direccion ?? null,
    p_sii_status: res.status,
    p_folio: res.folio ?? null,
    p_track_id: res.trackId ?? null,
    p_pdf_url: res.pdfUrl ?? null,
    p_xml_url: res.xmlUrl ?? null,
    p_payment_id: input.paymentId ?? null,
  })
  if (error) {
    logger.error("DTE emitido pero no se pudo registrar", error)
    return fail("El documento se emitió pero no se pudo registrar. Reintentá.")
  }

  return ok({ id: docId as number, status: res.status, folio: res.folio ?? null })
}

/**
 * Reconsulta el estado de un documento en trámite (worker de sondeo del SII).
 * Con el adaptador simulado no hay pendientes; queda listo para el real.
 */
export async function refreshDocumentStatus(id: number, trackId: string): Promise<Result<null>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const adapter = getDteAdapter()
  const res = await adapter.checkStatus(trackId)
  const { error } = await supabase.rpc("dte_update_status", {
    p_id: id,
    p_sii_status: res.status,
    p_folio: res.folio ?? null,
    p_pdf_url: res.pdfUrl ?? null,
    p_xml_url: res.xmlUrl ?? null,
  })
  if (error) return fail("No se pudo actualizar el estado del documento")
  return ok(null)
}
