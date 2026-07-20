"use client"

import { useCallback, useEffect, useState, type ChangeEvent } from "react"
import { supabase } from "@/lib/supabase"
import { clearUserScopedCache } from "@/lib/session-cache"

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

type Branch = {
  restaurant_id: number
  restaurant_name: string
  branch_label: string | null
  city: string | null
  is_current: boolean
  tables_count: number
  orders_total: number
  revenue_total: number
}
type BranchesData = {
  org_id: number | null
  max_branches: number | null
  used: number
  can_create: boolean
  branches: Branch[]
}
type OrgProfile = {
  name: string
  legal_name: string | null
  rut: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  city: string | null
  max_branches: number | null
  branches_count: number
}

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"

export default function SucursalesPage() {
  const [data, setData] = useState<BranchesData | null>(null)
  const [org, setOrg] = useState<OrgProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [editOrg, setEditOrg] = useState(false)
  const [showCopy, setShowCopy] = useState(false)

  const reload = useCallback(async () => {
    const [{ data: bd }, { data: od }] = await Promise.all([
      supabase.rpc("get_my_branches"),
      supabase.rpc("get_my_organization"),
    ])
    setData((bd ?? null) as BranchesData | null)
    setOrg((od ?? null) as OrgProfile | null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al montar
    void reload()
  }, [reload])

  async function switchTo(id: number) {
    if (busy) return
    setBusy(true)
    const { error: e } = await supabase.rpc("set_active_restaurant", { p_restaurant_id: id })
    if (e) {
      setError(e.message)
      setBusy(false)
      return
    }
    clearUserScopedCache()
    window.location.assign("/admin")
  }

  if (loading) {
    return <p className="animate-pulse rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm font-semibold text-stone-500">Cargando sucursales…</p>
  }

  const branches = data?.branches ?? []
  const isGroup = (data?.org_id ?? null) !== null && branches.length > 0

  if (!isGroup) {
    return (
      <section className="rounded-3xl bg-white p-10 text-center ring-1 ring-stone-200 shadow-sm">
        <h2 className="text-lg font-bold text-stone-900">Sucursales</h2>
        <p className="mt-2 text-sm text-stone-600">Tu restaurante no pertenece a un grupo multi-sucursal.</p>
        <p className="mt-1 text-sm text-stone-500">Es una función para cadenas (plan Personalizado). Contacta a soporte para activarla.</p>
      </section>
    )
  }

  const max = data?.max_branches ?? null
  const used = data?.used ?? branches.length
  const canCreate = data?.can_create ?? false

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-stone-900">Sucursales</h2>
          <p className="mt-1 text-sm text-stone-500">
            Administra los locales de tu grupo desde una sola cuenta. Cupo: <span className="font-bold text-stone-700">{used}{max != null ? ` de ${max}` : ""}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCopy((v) => !v)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 shadow-sm transition hover:border-orange-300 hover:text-orange-600"
          >
            Copiar menú entre locales
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => setShowCreate((v) => !v)}
            title={canCreate ? undefined : "Alcanzaste el cupo de tu plan"}
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nueva sucursal
          </button>
        </div>
      </section>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {showCreate && canCreate && (
        <BranchForm
          title="Nueva sucursal"
          busy={busy}
          onCancel={() => setShowCreate(false)}
          onSubmit={async (v) => {
            setBusy(true)
            setError("")
            const { error: e } = await supabase.rpc("create_branch", {
              p_name: v.name,
              p_branch_label: v.label || null,
              p_city: v.city || null,
              p_tables: v.tables,
            })
            setBusy(false)
            if (e) { setError(e.message); return }
            setShowCreate(false)
            await reload()
          }}
        />
      )}

      {editing && (
        <BranchForm
          title={`Editar “${editing.restaurant_name}”`}
          busy={busy}
          initial={{ name: editing.restaurant_name, label: editing.branch_label ?? "", city: editing.city ?? "" }}
          hideTables
          onCancel={() => setEditing(null)}
          onSubmit={async (v) => {
            setBusy(true)
            setError("")
            const { error: e } = await supabase.rpc("update_my_branch", {
              p_restaurant_id: editing.restaurant_id,
              p_name: v.name,
              p_branch_label: v.label || null,
              p_city: v.city || null,
            })
            setBusy(false)
            if (e) { setError(e.message); return }
            setEditing(null)
            await reload()
          }}
        />
      )}

      {showCopy && <CopyMenuPanel branches={branches} busy={busy} onClose={() => setShowCopy(false)} onCopy={async (source, target) => {
        setBusy(true)
        setError("")
        const { data: res, error: e } = await supabase.rpc("copy_menu_to_branch", { p_source: source, p_target: target })
        setBusy(false)
        if (e) { setError(e.message); return null }
        return res as { categories: number; products: number; variants: number }
      }} />}

      {/* LISTA DE SUCURSALES */}
      <section className="space-y-2">
        {branches.map((b) => (
          <div key={b.restaurant_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-bold text-stone-900">{b.restaurant_name}</p>
                {b.branch_label && <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">{b.branch_label}</span>}
                {b.is_current && <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 ring-1 ring-orange-200">Actual</span>}
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                {b.city ? `${b.city} · ` : ""}{b.tables_count} mesas · {b.orders_total} pedidos · <span className="font-semibold text-orange-600">{clp.format(b.revenue_total)}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {!b.is_current && (
                <button type="button" disabled={busy} onClick={() => switchTo(b.restaurant_id)} className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-bold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50">
                  Entrar
                </button>
              )}
              <button type="button" onClick={() => { setEditing(b); setShowCreate(false) }} className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-bold text-stone-700 transition hover:bg-stone-100">
                Editar
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* DATOS DEL GRUPO */}
      {org && (
        <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-stone-900">Datos del grupo</h3>
            <button type="button" onClick={() => setEditOrg((v) => !v)} className="text-xs font-bold text-orange-600 hover:text-orange-700">
              {editOrg ? "Cancelar" : "Editar"}
            </button>
          </div>

          {!editOrg ? (
            <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
              <Field label="Nombre" value={org.name} />
              <Field label="Razón social" value={org.legal_name} />
              <Field label="RUT" value={org.rut} />
              <Field label="Contacto" value={org.contact_name} />
              <Field label="Correo" value={org.contact_email} />
              <Field label="Teléfono" value={org.contact_phone} />
              <Field label="Dirección" value={[org.address, org.city].filter(Boolean).join(", ") || null} />
            </dl>
          ) : (
            <OrgForm
              busy={busy}
              org={org}
              onCancel={() => setEditOrg(false)}
              onSubmit={async (v) => {
                setBusy(true)
                setError("")
                const { error: e } = await supabase.rpc("update_my_organization", {
                  p_name: v.name,
                  p_legal_name: v.legal_name || null,
                  p_rut: v.rut || null,
                  p_contact_name: v.contact_name || null,
                  p_contact_email: v.contact_email || null,
                  p_contact_phone: v.contact_phone || null,
                  p_address: v.address || null,
                  p_city: v.city || null,
                })
                setBusy(false)
                if (e) { setError(e.message); return }
                setEditOrg(false)
                await reload()
              }}
            />
          )}
        </section>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <dt className="font-bold text-stone-400">{label}:</dt>
      <dd className="text-stone-700">{value}</dd>
    </div>
  )
}

type BranchFormValues = { name: string; label: string; city: string; tables: number }

function BranchForm({
  title, busy, initial, hideTables, onSubmit, onCancel,
}: {
  title: string
  busy: boolean
  initial?: { name: string; label: string; city: string }
  hideTables?: boolean
  onSubmit: (v: BranchFormValues) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [label, setLabel] = useState(initial?.label ?? "")
  const [city, setCity] = useState(initial?.city ?? "")
  const [tables, setTables] = useState("0")

  return (
    <section className="rounded-3xl border border-orange-200 bg-orange-50/40 p-5">
      <h3 className="text-sm font-bold text-stone-900">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-stone-600">
          Nombre del local *
          <input className={`mt-1 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mi Restaurante — Centro" />
        </label>
        <label className="text-xs font-semibold text-stone-600">
          Etiqueta (identificación corta)
          <input className={`mt-1 ${inputCls}`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Centro" />
        </label>
        <label className="text-xs font-semibold text-stone-600">
          Ciudad
          <input className={`mt-1 ${inputCls}`} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Santiago" />
        </label>
        {!hideTables && (
          <label className="text-xs font-semibold text-stone-600">
            Mesas iniciales
            <input type="number" min="0" max="200" className={`mt-1 ${inputCls}`} value={tables} onChange={(e) => setTables(e.target.value)} />
          </label>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-50">Cancelar</button>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => onSubmit({ name: name.trim(), label: label.trim(), city: city.trim(), tables: Math.max(0, parseInt(tables || "0", 10) || 0) })}
          className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </section>
  )
}

function OrgForm({
  busy, org, onSubmit, onCancel,
}: {
  busy: boolean
  org: OrgProfile
  onSubmit: (v: Omit<OrgProfile, "max_branches" | "branches_count">) => void
  onCancel: () => void
}) {
  const [f, setF] = useState({
    name: org.name ?? "",
    legal_name: org.legal_name ?? "",
    rut: org.rut ?? "",
    contact_name: org.contact_name ?? "",
    contact_email: org.contact_email ?? "",
    contact_phone: org.contact_phone ?? "",
    address: org.address ?? "",
    city: org.city ?? "",
  })
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }))

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-stone-600">Nombre del grupo *<input className={`mt-1 ${inputCls}`} value={f.name} onChange={set("name")} /></label>
      <label className="text-xs font-semibold text-stone-600">Razón social<input className={`mt-1 ${inputCls}`} value={f.legal_name} onChange={set("legal_name")} /></label>
      <label className="text-xs font-semibold text-stone-600">RUT<input className={`mt-1 ${inputCls}`} value={f.rut} onChange={set("rut")} placeholder="76.543.210-K" /></label>
      <label className="text-xs font-semibold text-stone-600">Contacto<input className={`mt-1 ${inputCls}`} value={f.contact_name} onChange={set("contact_name")} /></label>
      <label className="text-xs font-semibold text-stone-600">Correo<input className={`mt-1 ${inputCls}`} value={f.contact_email} onChange={set("contact_email")} /></label>
      <label className="text-xs font-semibold text-stone-600">Teléfono<input className={`mt-1 ${inputCls}`} value={f.contact_phone} onChange={set("contact_phone")} /></label>
      <label className="text-xs font-semibold text-stone-600">Dirección<input className={`mt-1 ${inputCls}`} value={f.address} onChange={set("address")} /></label>
      <label className="text-xs font-semibold text-stone-600">Ciudad<input className={`mt-1 ${inputCls}`} value={f.city} onChange={set("city")} /></label>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-50">Cancelar</button>
        <button type="button" disabled={busy || !f.name.trim()} onClick={() => onSubmit(f)} className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar datos del grupo"}
        </button>
      </div>
    </div>
  )
}

function CopyMenuPanel({
  branches, busy, onCopy, onClose,
}: {
  branches: Branch[]
  busy: boolean
  onCopy: (source: number, target: number) => Promise<{ categories: number; products: number; variants: number } | null>
  onClose: () => void
}) {
  const [source, setSource] = useState<number | "">("")
  const [target, setTarget] = useState<number | "">("")
  const [result, setResult] = useState<string>("")

  async function run() {
    if (source === "" || target === "" || source === target) return
    if (!window.confirm("Se AGREGARÁ la carta del local de origen al de destino (no reemplaza lo existente). ¿Continuar?")) return
    setResult("")
    const res = await onCopy(Number(source), Number(target))
    if (res) setResult(`Copiado: ${res.categories} categorías, ${res.products} productos, ${res.variants} variantes.`)
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-stone-900">Copiar menú entre locales</h3>
        <button type="button" onClick={onClose} className="text-xs font-bold text-stone-500 hover:text-stone-800">Cerrar</button>
      </div>
      <p className="mt-1 text-xs text-stone-500">Copia categorías, productos y variantes de un local a otro para no cargar todo de cero.</p>
      <div className="mt-3 grid items-end gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-stone-600">
          Desde
          <select className={`mt-1 ${inputCls}`} value={source} onChange={(e) => setSource(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Elegir origen</option>
            {branches.map((b) => <option key={b.restaurant_id} value={b.restaurant_id}>{b.restaurant_name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-stone-600">
          Hacia
          <select className={`mt-1 ${inputCls}`} value={target} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Elegir destino</option>
            {branches.filter((b) => b.restaurant_id !== source).map((b) => <option key={b.restaurant_id} value={b.restaurant_id}>{b.restaurant_name}</option>)}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || source === "" || target === "" || source === target}
          onClick={run}
          className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-orange-600 disabled:opacity-50"
        >
          {busy ? "Copiando…" : "Copiar carta"}
        </button>
      </div>
      {result && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{result}</p>}
    </section>
  )
}
