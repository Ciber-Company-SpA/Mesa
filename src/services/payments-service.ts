"use server"

import { z } from "zod"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"

export type TaxProfile = {
  rut: string
  razonSocial: string
  giro: string
  direccion: string
  comuna: string
  actividadEconomica: string
  regimenIva: string
}

export type PaymentAccount = {
  provider: string | null
  status: string
  connectedAt: string | null
}

const TaxProfileSchema = z.object({
  rut: z.string().trim().max(20, "Máximo 20 caracteres"),
  razonSocial: z.string().trim().max(120, "Máximo 120 caracteres"),
  giro: z.string().trim().max(200, "Máximo 200 caracteres"),
  direccion: z.string().trim().max(160, "Máximo 160 caracteres"),
  comuna: z.string().trim().max(80, "Máximo 80 caracteres"),
  actividadEconomica: z.string().trim().max(200, "Máximo 200 caracteres"),
  regimenIva: z.string().trim().max(40, "Máximo 40 caracteres"),
})

export type SaveTaxProfileInput = z.infer<typeof TaxProfileSchema>

type TaxProfileRow = {
  rut?: string | null
  razon_social?: string | null
  giro?: string | null
  direccion?: string | null
  comuna?: string | null
  actividad_economica?: string | null
  regimen_iva?: string | null
}

function str(v: string | null | undefined): string {
  return v == null ? "" : String(v)
}

export async function getTaxProfile(): Promise<Result<TaxProfile>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase.rpc("get_my_tax_profile")

  if (error) return fail("Error al cargar los datos tributarios")

  const raw = (data ?? {}) as TaxProfileRow

  return ok({
    rut: str(raw.rut),
    razonSocial: str(raw.razon_social),
    giro: str(raw.giro),
    direccion: str(raw.direccion),
    comuna: str(raw.comuna),
    actividadEconomica: str(raw.actividad_economica),
    regimenIva: str(raw.regimen_iva),
  })
}

export async function saveTaxProfile(
  input: SaveTaxProfileInput
): Promise<Result<null>> {
  const parsed = TaxProfileSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { error } = await supabase.rpc("upsert_my_tax_profile", {
    p_rut: parsed.data.rut,
    p_razon: parsed.data.razonSocial,
    p_giro: parsed.data.giro,
    p_direccion: parsed.data.direccion,
    p_comuna: parsed.data.comuna,
    p_actividad: parsed.data.actividadEconomica,
    p_regimen: parsed.data.regimenIva,
  })

  if (error) return fail("No se pudo guardar los datos tributarios")

  return ok(null)
}

type PaymentAccountRow = {
  provider?: string | null
  status?: string | null
  connected_at?: string | null
}

export async function getPaymentAccount(): Promise<Result<PaymentAccount>> {
  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)
  const { supabase } = auth.data

  const { data, error } = await supabase.rpc("get_my_payment_account")

  if (error) return fail("Error al cargar el estado de cobros")

  const raw = (data ?? {}) as PaymentAccountRow

  return ok({
    provider: raw.provider ?? null,
    status: raw.status ?? "disconnected",
    connectedAt: raw.connected_at ?? null,
  })
}
