"use server"

import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"

export type DteCafItem = {
  id: number
  docType: number
  folioDesde: number | null
  folioHasta: number | null
  filename: string | null
  uploadedAt: string
}

export type DteCredentials = {
  certificate: {
    filename: string | null
    expiresOn: string | null
    uploadedAt: string | null
  } | null
  caf: DteCafItem[]
}

type CafRow = {
  id: number
  doc_type: number
  folio_desde: number | null
  folio_hasta: number | null
  filename: string | null
  uploaded_at: string
}

export async function getDteCredentials(): Promise<Result<DteCredentials>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase.rpc("get_my_dte_credentials")
  if (error) return fail("No se pudieron cargar las credenciales")

  const cert = data?.certificate
    ? {
        filename: (data.certificate.filename as string) ?? null,
        expiresOn: (data.certificate.expires_on as string) ?? null,
        uploadedAt: (data.certificate.uploaded_at as string) ?? null,
      }
    : null
  const caf = ((data?.caf ?? []) as CafRow[]).map((r) => ({
    id: r.id,
    docType: r.doc_type,
    folioDesde: r.folio_desde,
    folioHasta: r.folio_hasta,
    filename: r.filename,
    uploadedAt: r.uploaded_at,
  }))
  return ok({ certificate: cert, caf })
}

export async function saveCertificate(input: {
  certBase64: string
  password: string
  filename: string
  expires: string | null
}): Promise<Result<null>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  if (!input.certBase64) return fail("Falta el archivo del certificado")
  // El .pfx pesa pocos KB; cota defensiva por si suben algo enorme.
  if (input.certBase64.length > 2_000_000) return fail("El certificado es demasiado grande")

  const { error } = await supabase.rpc("dte_save_certificate", {
    p_cert_b64: input.certBase64,
    p_password: input.password ?? "",
    p_filename: input.filename ?? null,
    p_expires: input.expires || null,
  })
  if (error) return fail("No se pudo guardar el certificado")
  return ok(null)
}

export async function deleteCertificate(): Promise<Result<null>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data
  const { error } = await supabase.rpc("dte_delete_certificate")
  if (error) return fail("No se pudo borrar el certificado")
  return ok(null)
}

export async function saveCaf(input: {
  docType: number
  cafBase64: string
  folioDesde: number | null
  folioHasta: number | null
  filename: string
}): Promise<Result<null>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  if (!input.cafBase64) return fail("Falta el archivo CAF")
  if (input.cafBase64.length > 2_000_000) return fail("El archivo CAF es demasiado grande")

  const { error } = await supabase.rpc("dte_save_caf", {
    p_doc_type: input.docType,
    p_caf_b64: input.cafBase64,
    p_folio_desde: input.folioDesde,
    p_folio_hasta: input.folioHasta,
    p_filename: input.filename ?? null,
  })
  if (error) return fail("No se pudo guardar el CAF")
  return ok(null)
}

export async function deleteCaf(id: number): Promise<Result<null>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data
  const { error } = await supabase.rpc("dte_delete_caf", { p_id: id })
  if (error) return fail("No se pudo borrar el CAF")
  return ok(null)
}
