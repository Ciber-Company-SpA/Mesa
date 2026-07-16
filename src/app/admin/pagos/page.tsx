"use client"

import { useEffect, useState } from "react"
import {
  getTaxProfile,
  saveTaxProfile,
  getPaymentAccount,
  type TaxProfile,
} from "@/services/payments-service"
import {
  listTaxDocuments,
  emitDocument,
  type TaxDocument,
} from "@/services/dte-service"
import { DTE_LABEL_BY_CODE } from "@/lib/dte/types"
import {
  useSiiActividades,
  useSiiRubros,
  SiiActividadCombobox,
} from "@/components/admin/SiiActividadCombobox"

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

const DTE_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  error: "bg-red-50 text-red-700 ring-red-200",
}
const DTE_STATUS_LABEL: Record<string, string> = {
  pending: "En trámite",
  accepted: "Aceptado",
  rejected: "Rechazado",
  error: "Error",
}

const EMPTY_PROFILE: TaxProfile = {
  rut: "",
  razonSocial: "",
  giro: "",
  direccion: "",
  comuna: "",
  actividadEconomica: "",
  regimenIva: "Régimen general",
}

const REGIMEN_OPTIONS = ["Régimen general", "Pro Pyme", "Otro"] as const

const INPUT_CLASS =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"

const LABEL_CLASS =
  "mb-2 block text-xs font-bold uppercase tracking-wider text-stone-500"

function TaxProfileSection() {
  const [profile, setProfile] = useState<TaxProfile>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)
  const { items: actividades, loading: catLoading } = useSiiActividades()
  const { items: rubros } = useSiiRubros()

  useEffect(() => {
    let active = true
    ;(async () => {
      const result = await getTaxProfile()
      if (!active) return
      if (result.ok) {
        setProfile({
          ...result.data,
          regimenIva: result.data.regimenIva || "Régimen general",
        })
      } else {
        setFeedback({ kind: "error", message: result.error })
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof TaxProfile>(key: K, value: TaxProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setFeedback(null)
    try {
      const result = await saveTaxProfile(profile)
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      setFeedback({ kind: "ok", message: "Guardado" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-stone-900">Datos tributarios</h3>
      <p className="mt-1 text-xs font-medium text-stone-500">
        Estos datos se usarán para emitir boletas y facturas a nombre del restaurante.
      </p>

      {loading ? (
        <p className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-center text-sm font-semibold text-stone-500 animate-pulse">
          Cargando datos...
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>RUT</label>
              <input
                type="text"
                value={profile.rut}
                onChange={(e) => update("rut", e.target.value)}
                maxLength={20}
                placeholder="76.123.456-7"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Razón social</label>
              <input
                type="text"
                value={profile.razonSocial}
                onChange={(e) => update("razonSocial", e.target.value)}
                maxLength={120}
                placeholder="Mi Restaurante SpA"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Giro (rubro SII)</label>
              <select
                value={profile.giro}
                onChange={(e) => update("giro", e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Seleccioná un rubro…</option>
                {profile.giro && !rubros.some((r) => r.nombre === profile.giro) ? (
                  <option value={profile.giro}>{profile.giro}</option>
                ) : null}
                {rubros.map((r) => (
                  <option key={r.codigo} value={r.nombre}>
                    {r.codigo} — {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASS}>Actividad económica</label>
              <SiiActividadCombobox
                items={actividades}
                loading={catLoading}
                value={profile.actividadEconomica}
                placeholder="Buscá por código o nombre (SII)"
                onSelect={(it) => {
                  update("actividadEconomica", `${it.codigo} - ${it.glosa}`)
                  const rubroNombre = rubros.find((r) => r.codigo === it.rubro)?.nombre
                  if (rubroNombre && !profile.giro.trim()) update("giro", rubroNombre)
                }}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Dirección</label>
              <input
                type="text"
                value={profile.direccion}
                onChange={(e) => update("direccion", e.target.value)}
                maxLength={160}
                placeholder="Av. Siempre Viva 123"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Comuna</label>
              <input
                type="text"
                value={profile.comuna}
                onChange={(e) => update("comuna", e.target.value)}
                maxLength={80}
                placeholder="Providencia"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Régimen IVA</label>
              <select
                value={profile.regimenIva}
                onChange={(e) => update("regimenIva", e.target.value)}
                className={INPUT_CLASS}
              >
                {REGIMEN_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {feedback && (
            <p
              className={`mt-5 rounded-lg px-3 py-2 text-xs font-medium ${
                feedback.kind === "ok"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {feedback.message}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function PaymentAccountSection() {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const result = await getPaymentAccount()
      if (!active) return
      if (result.ok) setStatus(result.data.status)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const isConnected = status === "connected"

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-stone-900">Cobros en línea</h3>
          <p className="mt-1 text-xs font-medium text-stone-500">
            Conectá tu cuenta para recibir pagos directo desde MESA.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${
            isConnected
              ? "bg-green-50 text-green-700 ring-green-200"
              : "bg-amber-50 text-amber-700 ring-amber-200"
          }`}
        >
          {loading ? "Cargando..." : isConnected ? "Conectado" : "Próximamente"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <p className="text-sm font-bold text-stone-900">Pendiente de configuración</p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          El cobro en línea a través de MESA estará disponible próximamente. Aquí podrás
          conectar tu cuenta para recibir pagos directo, con la boleta/factura emitida a tu
          nombre.
        </p>

        <div className="mt-5">
          <button
            type="button"
            disabled
            title="Disponible pronto"
            className="cursor-not-allowed rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white opacity-50 shadow"
          >
            Conectar
          </button>
        </div>
      </div>
    </section>
  )
}

function TaxDocumentsSection() {
  const [docs, setDocs] = useState<TaxDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState("10000")
  const [emitting, setEmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  async function load() {
    const result = await listTaxDocuments()
    if (result.ok) setDocs(result.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function emitTest() {
    if (emitting) return
    const total = parseInt(amount.replace(/[^\d]/g, ""), 10)
    if (!Number.isFinite(total) || total <= 0) {
      setFeedback({ kind: "error", message: "Ingresá un monto válido." })
      return
    }
    setEmitting(true)
    setFeedback(null)
    try {
      const result = await emitDocument({ type: "boleta", total })
      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error })
        return
      }
      setFeedback({ kind: "ok", message: `Boleta simulada emitida (folio ${result.data.folio}).` })
      await load()
    } finally {
      setEmitting(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-stone-900">Documentos tributarios</h3>
      <p className="mt-1 text-xs font-medium text-stone-500">
        Historial de boletas y facturas emitidas. La emisión real se activa al
        integrar el proveedor y certificar ante el SII.
      </p>

      {/* Panel de simulación (solo para validar el flujo) */}
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
          Modo simulación
        </p>
        <p className="mt-1 text-xs text-amber-700/90">
          Emite un documento de prueba para validar el circuito. NO es un documento válido ante el SII.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className={LABEL_CLASS}>Monto total (CLP)</label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={INPUT_CLASS + " w-40"}
            />
          </div>
          <button
            type="button"
            onClick={emitTest}
            disabled={emitting}
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-stone-700 disabled:opacity-50"
          >
            {emitting ? "Emitiendo…" : "Emitir boleta de prueba (simulación)"}
          </button>
        </div>
        {feedback && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
              feedback.kind === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
              <th className="py-2 pr-4">Documento</th>
              <th className="py-2 pr-4">Folio</th>
              <th className="py-2 pr-4 text-right">Total</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2">Emitido</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm font-semibold text-stone-500 animate-pulse">
                  Cargando…
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-stone-500">
                  Aún no hay documentos emitidos.
                </td>
              </tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="border-b border-stone-50 last:border-b-0">
                  <td className="py-2.5 pr-4">
                    <span className="font-semibold text-stone-900">
                      {DTE_LABEL_BY_CODE[d.docType] ?? `Tipo ${d.docType}`}
                    </span>
                    {d.simulated ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Simulado
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-stone-700">{d.folio ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold tabular-nums text-stone-900">
                    {d.total != null ? clp.format(d.total) : "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${DTE_STATUS_BADGE[d.siiStatus] ?? "bg-stone-100 text-stone-600 ring-stone-200"}`}>
                      {DTE_STATUS_LABEL[d.siiStatus] ?? d.siiStatus}
                    </span>
                  </td>
                  <td className="py-2.5 text-stone-500">
                    {d.emittedAt ? new Date(d.emittedAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function PagosPage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">
          Pagos y facturación
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Cargá los datos tributarios de tu restaurante y revisá el estado de los cobros en línea.
        </p>
      </section>

      <TaxProfileSection />
      <PaymentAccountSection />
      <TaxDocumentsSection />
    </div>
  )
}
