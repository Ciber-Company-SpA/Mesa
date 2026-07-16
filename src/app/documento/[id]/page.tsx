import { getDocumentForView } from "@/services/dte-service"
import { DTE_LABEL_BY_CODE } from "@/lib/dte/types"
import { DocumentActions } from "@/components/dte/DocumentActions"

export const dynamic = "force-dynamic"

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

function fmtDate(v: string | null): string {
  if (!v) return "—"
  return new Date(v).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })
}

export default async function DocumentoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getDocumentForView(Number(id))

  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {result.error}
        </p>
      </main>
    )
  }

  const { doc, emisor } = result.data
  const label = DTE_LABEL_BY_CODE[doc.docType] ?? `Documento ${doc.docType}`

  return (
    <main className="mx-auto max-w-2xl p-6 print:p-0">
      {/* Barra de acciones (no se imprime) */}
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <a href="/admin/pagos" className="text-sm font-semibold text-stone-500 transition hover:text-orange-600">
          ← Volver a Pagos
        </a>
        <DocumentActions doc={doc} emisor={{ rut: emisor.rut, razonSocial: emisor.razonSocial }} />
      </div>

      {/* Documento */}
      <article className="rounded-2xl border border-stone-300 bg-white p-8 text-stone-900 shadow-sm print:border-0 print:shadow-none">
        {doc.simulated ? (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-amber-700">
            Documento simulado · sin validez tributaria ante el SII
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-6 border-b border-stone-200 pb-5">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-stone-900">
              {emisor.razonSocial || "Restaurante"}
            </p>
            <dl className="mt-1 space-y-0.5 text-xs text-stone-600">
              {emisor.rut ? <div>RUT: {emisor.rut}</div> : null}
              {emisor.giro ? <div>Giro: {emisor.giro}</div> : null}
              {emisor.direccion || emisor.comuna ? (
                <div>{[emisor.direccion, emisor.comuna].filter(Boolean).join(", ")}</div>
              ) : null}
            </dl>
          </div>
          <div className="shrink-0 rounded-lg border-2 border-red-600 px-4 py-3 text-center text-red-700">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wider">R.U.T. {emisor.rut || "—"}</p>
            <p className="mt-1 text-xs font-extrabold uppercase leading-tight">{label}</p>
            <p className="mt-1 text-sm font-extrabold tabular-nums">N° {doc.folio ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-stone-600">
          <span>Fecha de emisión: <strong className="text-stone-800">{fmtDate(doc.emittedAt)}</strong></span>
          <span>Estado: <strong className="text-stone-800">{doc.simulated ? "Simulado (aceptado)" : doc.trackId ? "Emitido" : "—"}</strong></span>
        </div>

        {/* Receptor (facturas / cuando hay datos) */}
        {doc.receptorRut || doc.receptorRazon ? (
          <div className="mt-5 rounded-lg bg-stone-50 px-4 py-3 text-xs text-stone-700">
            <p className="font-bold uppercase tracking-wider text-stone-500">Receptor</p>
            <p className="mt-1">{doc.receptorRazon ?? "—"}{doc.receptorRut ? ` · RUT ${doc.receptorRut}` : ""}</p>
          </div>
        ) : null}

        {/* Totales */}
        <div className="mt-6 ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-stone-600">
            <span>Neto</span>
            <span className="tabular-nums">{doc.net != null ? clp.format(doc.net) : "—"}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>IVA (19%)</span>
            <span className="tabular-nums">{doc.iva != null ? clp.format(doc.iva) : "—"}</span>
          </div>
          <div className="flex justify-between border-t border-stone-300 pt-1.5 text-base font-extrabold text-stone-900">
            <span>Total</span>
            <span className="tabular-nums">{doc.total != null ? clp.format(doc.total) : "—"}</span>
          </div>
        </div>

        {/* Timbre electrónico (marcador) */}
        <div className="mt-8 border-t border-dashed border-stone-300 pt-5 text-center">
          <div className="mx-auto h-16 w-56 bg-[repeating-linear-gradient(90deg,#1c1917_0,#1c1917_2px,transparent_2px,transparent_4px)] opacity-70" aria-hidden />
          <p className="mt-2 text-[10px] text-stone-500">
            Timbre Electrónico SII{doc.simulated ? " (simulado)" : ""} · Track ID {doc.trackId ?? "—"}
          </p>
          <p className="text-[10px] text-stone-400">Verifique este documento en www.sii.cl</p>
        </div>
      </article>
    </main>
  )
}
