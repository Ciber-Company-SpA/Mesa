"use client"

import { DTE_LABEL_BY_CODE } from "@/lib/dte/types"

export type DocumentViewData = {
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
  trackId: string | null
  emittedAt: string | null
  simulated: boolean
}

export type DocumentViewEmisor = {
  rut: string
  razonSocial: string
  giro: string
  direccion: string
  comuna: string
  actividadEconomica: string
  logoUrl: string | null
}

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

function fmtDate(v: string | null): string {
  if (!v) return "—"
  return new Date(v).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p className="text-xs leading-5 text-stone-700">
      <span className="font-semibold text-stone-500">{label}:</span> {value?.trim() ? value : "—"}
    </p>
  )
}

/**
 * Representación imprimible de un documento tributario electrónico chileno,
 * siguiendo la estructura exigida por el SII para la representación impresa:
 * datos del emisor + logo, recuadro rojo (RUT, tipo, folio, unidad SII),
 * receptor (en factura), detalle, totales con desglose de IVA, y el área de
 * timbre electrónico (PDF417 + resolución + leyenda de verificación). La
 * factura incluye además la leyenda de acuse de recibo (Ley N° 19.983).
 * data-print-root permite imprimir solo el documento.
 */
export function DocumentView({ doc, emisor }: { doc: DocumentViewData; emisor: DocumentViewEmisor }) {
  const label = (DTE_LABEL_BY_CODE[doc.docType] ?? `Documento ${doc.docType}`).toUpperCase()
  const esFactura = doc.docType === 33 || doc.docType === 34
  const esBoleta = doc.docType === 39 || doc.docType === 41
  const ciudad = emisor.comuna?.trim() || "SANTIAGO"

  return (
    <article
      data-print-root
      className="rounded-2xl border border-stone-300 bg-white p-8 text-stone-900 shadow-sm print:border-0 print:shadow-none"
    >
      {doc.simulated ? (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-amber-700">
          Documento simulado · sin validez tributaria ante el SII
        </div>
      ) : null}

      {/* Encabezado: emisor + logo (izq) y recuadro rojo (der) */}
      <div className="flex items-start justify-between gap-6 border-b border-stone-200 pb-5">
        <div className="flex items-start gap-4">
          {emisor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emisor.logoUrl} alt="Logo" className="h-16 w-16 shrink-0 rounded-lg object-contain" />
          ) : null}
          <div>
            <p className="text-base font-extrabold uppercase tracking-tight text-stone-900">
              {emisor.razonSocial || "Razón social del emisor"}
            </p>
            <div className="mt-1 space-y-0.5">
              <Field label="Giro" value={emisor.giro} />
              {emisor.actividadEconomica?.trim() ? (
                <Field label="Actividad" value={emisor.actividadEconomica} />
              ) : null}
              <Field
                label="Dirección"
                value={[emisor.direccion, emisor.comuna].filter((s) => s?.trim()).join(", ") || null}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-lg border-2 border-red-600 px-5 py-3 text-center text-red-700">
          <p className="text-xs font-extrabold tracking-wide">R.U.T. {emisor.rut || "—"}</p>
          <p className="mt-1.5 text-sm font-extrabold uppercase leading-tight">{label}</p>
          <p className="mt-1.5 text-sm font-extrabold tabular-nums">N° {doc.folio ?? "—"}</p>
          <p className="mt-1.5 border-t border-red-300 pt-1 text-[10px] font-bold uppercase tracking-wider">
            S.I.I. — {ciudad}
          </p>
        </div>
      </div>

      {/* Fecha */}
      <div className="mt-4 text-xs text-stone-600">
        Fecha de emisión: <strong className="text-stone-800">{fmtDate(doc.emittedAt)}</strong>
      </div>

      {/* Receptor: obligatorio en factura; en boleta solo si se registró */}
      {esFactura || doc.receptorRut || doc.receptorRazon ? (
        <div className="mt-4 rounded-lg bg-stone-50 px-4 py-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
            {esFactura ? "Señor(es) — Receptor" : "Receptor"}
          </p>
          <div className="grid gap-x-8 gap-y-0.5 sm:grid-cols-2">
            <Field label="Razón social" value={doc.receptorRazon} />
            <Field label="R.U.T." value={doc.receptorRut} />
            {esFactura ? <Field label="Giro" value={doc.receptorGiro} /> : null}
            {esFactura ? <Field label="Dirección" value={doc.receptorDir} /> : null}
          </div>
        </div>
      ) : null}

      {/* Condición de venta (factura) */}
      {esFactura ? (
        <div className="mt-3 text-xs text-stone-600">
          Condición de venta: <strong className="text-stone-800">Contado</strong>
        </div>
      ) : null}

      {/* Detalle */}
      <table className="mt-4 w-full text-xs">
        <thead>
          <tr className="border-y border-stone-200 text-left text-[10px] font-bold uppercase tracking-wider text-stone-500">
            <th className="py-1.5 pr-3">Descripción</th>
            <th className="py-1.5 pr-3 text-right">Cant.</th>
            <th className="py-1.5 pr-3 text-right">P. unitario</th>
            <th className="py-1.5 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-stone-100">
            <td className="py-2 pr-3 text-stone-800">Consumo / Servicios</td>
            <td className="py-2 pr-3 text-right tabular-nums text-stone-700">1</td>
            <td className="py-2 pr-3 text-right tabular-nums text-stone-700">
              {esBoleta ? clp.format(doc.total ?? 0) : clp.format(doc.net ?? 0)}
            </td>
            <td className="py-2 text-right tabular-nums font-semibold text-stone-900">
              {esBoleta ? clp.format(doc.total ?? 0) : clp.format(doc.net ?? 0)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Totales */}
      <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
        {esBoleta ? (
          <>
            <div className="flex justify-between text-[11px] text-stone-500">
              <span>Neto</span>
              <span className="tabular-nums">{doc.net != null ? clp.format(doc.net) : "—"}</span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-500">
              <span>IVA (19%) incluido</span>
              <span className="tabular-nums">{doc.iva != null ? clp.format(doc.iva) : "—"}</span>
            </div>
            <div className="flex justify-between border-t border-stone-300 pt-1.5 text-base font-extrabold text-stone-900">
              <span>Total (IVA incluido)</span>
              <span className="tabular-nums">{doc.total != null ? clp.format(doc.total) : "—"}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-stone-600">
              <span>Monto neto</span>
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
          </>
        )}
      </div>

      {/* Timbre electrónico */}
      <div className="mt-8 border-t border-dashed border-stone-300 pt-5 text-center">
        <div
          className="mx-auto h-16 w-56 bg-[repeating-linear-gradient(90deg,#1c1917_0,#1c1917_2px,transparent_2px,transparent_5px)] opacity-70"
          aria-hidden
        />
        <p className="mt-2 text-[10px] font-semibold text-stone-600">Timbre Electrónico SII</p>
        <p className="text-[10px] text-stone-500">
          {doc.simulated
            ? "Documento simulado — sin resolución del SII"
            : "Resolución que autoriza la emisión electrónica"}
          {" · Track ID "}
          {doc.trackId ?? "—"}
        </p>
        <p className="text-[10px] text-stone-400">Verifique este documento en www.sii.cl</p>
      </div>

      {/* Leyenda de acuse de recibo (Ley 19.983) — solo factura */}
      {esFactura ? (
        <p className="mt-5 border-t border-stone-200 pt-3 text-[9px] leading-4 text-stone-400">
          El acuse de recibo que se declara en este acto, de acuerdo a lo dispuesto en la letra b)
          del Art. 4°, y la letra c) del Art. 5° de la Ley N° 19.983, acredita que la entrega de
          mercaderías o servicio(s) prestado(s) ha(n) sido recibido(s).
        </p>
      ) : null}
    </article>
  )
}
