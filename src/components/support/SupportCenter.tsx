"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * Centro de soporte del cliente (panel admin y app del mesero): crea tickets
 * hacia el equipo MESA, sigue su estado y conversa en el hilo. El operador
 * responde desde el portal de administración de la plataforma.
 */

type TicketRow = {
  id: number
  subject: string
  category: string | null
  priority: string
  status: string
  channel: string
  requester_name: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  messages_count: number
  last_from: string | null
}

type Message = {
  id: number
  author_type: "customer" | "operator"
  author_name: string | null
  body: string
  created_at: string
}

type TicketDetail = {
  ticket: TicketRow & { description: string | null }
  messages: Message[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Abierto", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  in_progress: { label: "En curso", cls: "bg-orange-50 text-orange-700 ring-orange-200" },
  resolved: { label: "Resuelto", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  closed: { label: "Cerrado", cls: "bg-stone-100 text-stone-500 ring-stone-200" },
}

const PRIORITY: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "technical", label: "Falla técnica" },
  { value: "billing", label: "Facturación / cobros" },
  { value: "account", label: "Cuenta y accesos" },
  { value: "feature", label: "Solicitud / mejora" },
  { value: "other", label: "Otro" },
]

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

function fmtDate(v: string): string {
  const d = new Date(v)
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const fieldClass =
  "w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
const labelClass = "mb-1 block text-xs font-semibold text-stone-600"

export function SupportCenter() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("list_my_support_tickets")
    if (err) {
      setError("No se pudieron cargar tus tickets. Verificá tu sesión.")
    } else {
      setTickets((data ?? []) as TicketRow[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  if (loading) {
    return (
      <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm font-semibold text-stone-500 animate-pulse">
        Cargando soporte...
      </p>
    )
  }

  if (selectedId != null) {
    return (
      <TicketThread
        ticketId={selectedId}
        onBack={() => {
          setSelectedId(null)
          void reload()
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {creating ? (
        <NewTicketForm
          onDone={(id) => {
            setCreating(false)
            void reload()
            if (id != null) setSelectedId(id)
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-5 shadow-sm">
          <div>
            <p className="text-sm font-bold text-stone-900">¿Necesitás ayuda del equipo MESA?</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Creá un ticket y te respondemos aquí mismo; vas a ver la conversación en esta pantalla.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-95"
          >
            + Nuevo ticket
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <th className="px-5 py-3">Ticket</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Prioridad</th>
                <th className="px-5 py-3">Última actualización</th>
                <th className="px-5 py-3 text-right">Mensajes</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const st = STATUS[t.status] ?? STATUS.open
                const operatorReplied = t.last_from === "operator" && t.status !== "closed"
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="cursor-pointer border-b border-stone-50 transition last:border-b-0 hover:bg-stone-50"
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-stone-900">
                        #{t.id} · {t.subject}
                        {operatorReplied ? (
                          <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            Respuesta nueva
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400">
                        {t.category ? `${CATEGORY_LABEL[t.category] ?? t.category} · ` : ""}
                        {t.requester_name ?? ""}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-stone-600">{PRIORITY[t.priority] ?? t.priority}</td>
                    <td className="px-5 py-3 text-stone-500">{fmtDate(t.updated_at)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-stone-600">{t.messages_count}</td>
                  </tr>
                )
              })}
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-stone-500">
                    Sin tickets. Cuando necesites ayuda, creá uno y el equipo MESA te responderá aquí.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function NewTicketForm({
  onDone,
  onCancel,
}: {
  onDone: (ticketId: number | null) => void
  onCancel: () => void
}) {
  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState("technical")
  const [priority, setPriority] = useState("medium")
  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) {
      setError("Contanos en una línea qué pasó (asunto).")
      return
    }
    setPending(true)
    setError(null)
    const { data, error: err } = await supabase.rpc("create_support_ticket", {
      p_subject: subject.trim(),
      p_description: description.trim() || null,
      p_category: category,
      p_priority: priority,
    })
    setPending(false)
    if (err) {
      setError("No se pudo crear el ticket. Intentá de nuevo.")
      return
    }
    onDone(typeof data === "number" ? data : null)
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight text-stone-900">Nuevo ticket de soporte</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-stone-400 transition hover:text-stone-600"
        >
          Cancelar
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="sup-subject" className={labelClass}>Asunto *</label>
          <input
            id="sup-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: No se imprimen las comandas"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="sup-category" className={labelClass}>Categoría</label>
          <select id="sup-category" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sup-priority" className={labelClass}>Urgencia</label>
          <select id="sup-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass}>
            <option value="low">Baja — puede esperar</option>
            <option value="medium">Media — molesta pero opero</option>
            <option value="high">Alta — afecta la operación</option>
            <option value="urgent">Urgente — no puedo operar</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sup-desc" className={labelClass}>Descripción</label>
          <textarea
            id="sup-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contanos qué pasó, desde cuándo y qué ya probaste."
            className={fieldClass}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Crear ticket"}
        </button>
      </div>
    </form>
  )
}

function TicketThread({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [reply, setReply] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("get_my_support_ticket", {
      p_ticket_id: ticketId,
    })
    if (err) setError("No se pudo cargar el ticket.")
    else setDetail(data as TicketDetail)
  }, [ticketId])

  useEffect(() => {
    void load()
  }, [load])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim()) return
    setPending(true)
    const { error: err } = await supabase.rpc("reply_my_support_ticket", {
      p_ticket_id: ticketId,
      p_body: reply.trim(),
    })
    setPending(false)
    if (err) {
      setError("No se pudo enviar el mensaje.")
      return
    }
    setReply("")
    await load()
  }

  if (!detail) {
    return (
      <p className="rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center text-sm font-semibold text-stone-500 animate-pulse">
        {error ?? "Cargando ticket..."}
      </p>
    )
  }

  const t = detail.ticket
  const st = STATUS[t.status] ?? STATUS.open
  const closed = t.status === "closed"

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-semibold text-stone-500 transition hover:text-orange-600"
      >
        ← Mis tickets
      </button>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-stone-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-stone-900">#{t.id} · {t.subject}</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              {t.category ? `${CATEGORY_LABEL[t.category] ?? t.category} · ` : ""}
              Urgencia {PRIORITY[t.priority] ?? t.priority} · Creado el {fmtDate(t.created_at)}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${st.cls}`}>{st.label}</span>
        </div>

        <div className="mt-5 space-y-3">
          {detail.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.author_type === "operator"
                  ? "bg-orange-50 ring-1 ring-orange-100"
                  : "ml-auto bg-stone-100"
              }`}
            >
              <p className="text-[11px] font-bold text-stone-500">
                {m.author_type === "operator" ? "Soporte MESA" : m.author_name ?? "Vos"} ·{" "}
                <span className="font-medium text-stone-400">{fmtDate(m.created_at)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-stone-800">{m.body}</p>
            </div>
          ))}
          {detail.messages.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">
              Aún no hay mensajes en este ticket.
            </p>
          ) : null}
        </div>

        {closed ? (
          <p className="mt-5 rounded-2xl bg-stone-50 px-4 py-3 text-center text-xs font-semibold text-stone-500">
            Este ticket está cerrado. Si el problema vuelve, creá uno nuevo.
          </p>
        ) : (
          <form onSubmit={send} className="mt-5 flex items-end gap-3">
            <textarea
              rows={2}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={
                t.status === "resolved"
                  ? "¿Seguís con problemas? Respondé y el ticket se reabre."
                  : "Escribí tu respuesta…"
              }
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={pending || !reply.trim()}
              className="shrink-0 rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
            >
              {pending ? "Enviando…" : "Enviar"}
            </button>
          </form>
        )}
        {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
      </section>
    </div>
  )
}
