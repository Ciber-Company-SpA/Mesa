import { NextRequest, NextResponse } from "next/server"
import { requireCurrentAdmin, requireCurrentStaff } from "@/services/auth-guard"
import { getPaymentReceipt } from "@/services/charge-service"
import { getDteAdapter, isDteSimulated } from "@/lib/dte"

export const dynamic = "force-dynamic"

/**
 * PDF OFICIAL del DTE (representación impresa con timbre real del proveedor).
 * Solo con proveedor real (con el simulado no existe PDF válido y la app usa
 * su vista HTML imprimible).
 *
 *  · ?payment=<id> → staff (mesero/admin): boleta de un cobro.
 *  · ?doc=<id>     → admin: cualquier documento de su restaurante.
 */
export async function GET(req: NextRequest) {
  if (isDteSimulated()) {
    return NextResponse.json(
      { error: "El proveedor DTE está en modo simulado: no hay PDF oficial" },
      { status: 404 }
    )
  }

  const paymentId = Number(req.nextUrl.searchParams.get("payment"))
  const docId = Number(req.nextUrl.searchParams.get("doc"))

  let trackId: string | null = null
  let folio: number | null = null

  if (Number.isFinite(paymentId) && paymentId > 0) {
    const auth = await requireCurrentStaff()
    if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    const receipt = await getPaymentReceipt(paymentId)
    if (!receipt.ok) return NextResponse.json({ error: receipt.error }, { status: 404 })
    trackId = receipt.data.doc.trackId
    folio = receipt.data.doc.folio
  } else if (Number.isFinite(docId) && docId > 0) {
    const auth = await requireCurrentAdmin()
    if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    const { data } = await auth.data.supabase.rpc("get_my_tax_documents")
    const row = ((data ?? []) as Array<{ id: number; track_id: string | null; folio: number | null }>).find(
      (r) => r.id === docId
    )
    if (!row) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 })
    trackId = row.track_id
    folio = row.folio
  } else {
    return NextResponse.json({ error: "Falta payment o doc" }, { status: 400 })
  }

  if (!trackId || trackId.startsWith("SIM-")) {
    return NextResponse.json({ error: "El documento no tiene PDF oficial" }, { status: 404 })
  }

  const adapter = getDteAdapter()
  if (!adapter.getPdf) {
    return NextResponse.json({ error: "El proveedor no entrega PDF" }, { status: 404 })
  }

  const pdf = await adapter.getPdf(trackId)
  if (!pdf) {
    return NextResponse.json({ error: "No se pudo obtener el PDF del proveedor" }, { status: 502 })
  }

  return new NextResponse(pdf.data, {
    status: 200,
    headers: {
      "content-type": pdf.contentType,
      "content-disposition": `inline; filename="dte-${folio ?? "documento"}.pdf"`,
      "cache-control": "private, max-age=300",
    },
  })
}
