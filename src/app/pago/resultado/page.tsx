import Link from "next/link"

// Página a la que la pasarela devuelve al comensal (vía payment-return).
// Sin datos sensibles: solo el estado final y la vuelta al menú de su mesa.

export const dynamic = "force-dynamic"

const ESTADOS: Record<
  string,
  { icon: string; title: string; detail: string; tone: string }
> = {
  exito: {
    icon: "✅",
    title: "¡Pago exitoso!",
    detail: "Tu cuenta quedó pagada. El restaurante ya recibió la confirmación.",
    tone: "text-emerald-400",
  },
  pendiente: {
    icon: "⏳",
    title: "Pago en confirmación",
    detail:
      "Tu pago está siendo confirmado por la pasarela. Si ya pagaste, se acreditará en unos minutos; consultá en el mesón ante cualquier duda.",
    tone: "text-amber-300",
  },
  rechazado: {
    icon: "❌",
    title: "Pago rechazado",
    detail: "El pago no pudo completarse. Podés intentar de nuevo o pagar directo con tu mesero.",
    tone: "text-red-400",
  },
  cancelado: {
    icon: "↩️",
    title: "Pago cancelado",
    detail: "Cancelaste el pago antes de completarlo. Tu cuenta sigue abierta.",
    tone: "text-zinc-300",
  },
  error: {
    icon: "⚠️",
    title: "Algo salió mal",
    detail: "No pudimos identificar el pago. Si pagaste, avisá a tu mesero para verificarlo.",
    tone: "text-amber-300",
  },
}

export default async function PagoResultadoPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; r?: string }>
}) {
  const { estado, r } = await searchParams
  const info = ESTADOS[estado ?? ""] ?? ESTADOS.error
  const backHref = r ? `/${encodeURIComponent(r)}/menu` : null

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-6">
      <div className="w-full max-w-sm rounded-3xl border border-[#232327] bg-[#131315] p-8 text-center">
        <div className="text-5xl" aria-hidden="true">
          {info.icon}
        </div>
        <h1 className={`mt-4 text-xl font-extrabold ${info.tone}`}>{info.title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">{info.detail}</p>

        {backHref ? (
          <Link
            href={backHref}
            className="mt-6 inline-block w-full rounded-full bg-[#fb923c] px-5 py-3 text-sm font-extrabold text-[#1a1a1a] transition active:scale-95"
          >
            Volver al menú
          </Link>
        ) : (
          <p className="mt-6 text-xs text-[#71717a]">Podés cerrar esta ventana.</p>
        )}
      </div>
    </main>
  )
}
