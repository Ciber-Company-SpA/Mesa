import { NextResponse } from "next/server"
import { GoogleGenerativeAI, type Content } from "@google/generative-ai"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { checkAssistantLimit } from "@/lib/rate-limit"
import {
  functionDeclarations,
  executeTool,
  TOOL_LABELS,
  WRITE_TOOLS,
  type AssistantContext,
} from "@/lib/assistant/tools"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * ASISTENTE IA del panel admin: bucle agéntico con Gemini function calling.
 * El asistente actúa con la SESIÓN DEL ADMIN (RLS + guards = mismos límites
 * que el usuario) y ejecuta acciones reales vía las herramientas de
 * lib/assistant/tools. Responde NDJSON streaming (una línea JSON por evento):
 *   {type:"tool", name, label, write, status:"run"|"ok"|"error"}
 *   {type:"reply", text}   respuesta final del asistente
 *   {type:"error", message}
 *   {type:"done"}
 */

const MAX_TOOL_ITERATIONS = 8
const MAX_HISTORY_MESSAGES = 20
const MAX_MESSAGE_CHARS = 4000

const SYSTEM_PROMPT = `Eres el ASISTENTE de MESA, el sistema de gestión de restaurantes con pedidos por QR. Trabajas para el administrador del restaurante que te habla. Hablas español de Chile, cercano y profesional. Fecha actual: {FECHA}.

QUÉ ERES: un asistente OPERATIVO. No solo respondes: EJECUTAS tareas reales en el sistema usando tus herramientas (crear categorías y productos, ajustar precios y disponibilidad, crear cupones y promociones) y das recomendaciones fundadas en los datos reales del negocio (ventas, márgenes, horas peak, inventario).

REGLAS DE ORO:
1. NUNCA inventes datos del negocio: todo lo que afirmes sobre la carta, ventas o inventario debe salir de tus herramientas. Ante una tarea nueva, parte por obtener_resumen_negocio para conocer el contexto y no duplicar.
2. EJECUTA directo lo que te pidan crear o modificar (sin pedir permiso extra), y al terminar informa exactamente qué hiciste, con nombres y cantidades. Si la instrucción es ambigua en algo IMPORTANTE (ej. precios que no te dieron), decide tú con criterio de mercado chileno y dilo, o pregunta si es realmente necesario.
3. NO puedes borrar nada (no tienes herramientas de borrado). Si te piden eliminar, explica que eso se hace manualmente desde el panel por seguridad.
4. Precios SIEMPRE en pesos chilenos enteros (sin decimales). Formatea montos como $12.990.
5. Sé conciso: respuestas cortas, en texto plano (sin encabezados markdown). Listas con guiones solo cuando aportan.
6. Solo temas del restaurante y de MESA. Si te preguntan otra cosa, decláralo fuera de tu alcance con simpatía.
7. Si una herramienta devuelve errores parciales, informa qué se logró y qué no, sin dramatizar.
8. Los cambios en la carta pueden tardar hasta 5 minutos en verse en el menú QR del comensal (caché); el panel los muestra al tirar a recargar. Menciónalo solo si es relevante.

Tienes acceso al restaurante del administrador actual, y solo a ese.`

type ClientMessage = { role: "user" | "model"; text: string }

function sanitizeHistory(raw: unknown): ClientMessage[] {
  if (!Array.isArray(raw)) return []
  const msgs: ClientMessage[] = []
  for (const m of raw.slice(-MAX_HISTORY_MESSAGES)) {
    const role = (m as { role?: unknown }).role
    const text = String((m as { text?: unknown }).text ?? "").slice(0, MAX_MESSAGE_CHARS)
    if ((role === "user" || role === "model") && text.trim()) {
      msgs.push({ role, text })
    }
  }
  // Gemini exige que el historial empiece con 'user'.
  while (msgs.length > 0 && msgs[0].role !== "user") msgs.shift()
  return msgs
}

export async function POST(req: Request) {
  // Autenticación/autorización real: el asistente actúa como el admin logueado.
  const auth = await requireCurrentAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const ctx: AssistantContext = {
    supabase: auth.data.supabase,
    restaurantId: auth.data.restaurantId,
  }

  const { success } = await checkAssistantLimit(ctx.restaurantId)
  if (!success) {
    return NextResponse.json(
      { error: "Límite de uso del asistente alcanzado. Intentá de nuevo en un rato." },
      { status: 429 }
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "El asistente no está configurado (falta la API key)." }, { status: 503 })
  }

  let body: { messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const history = sanitizeHistory(body.messages)
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Falta el mensaje del usuario" }, { status: 400 })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.ASSISTANT_MODEL || "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT.replace(
      "{FECHA}",
      new Date().toLocaleDateString("es-CL", { dateStyle: "full", timeZone: "America/Santiago" })
    ),
    tools: [{ functionDeclarations }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  })

  const chatHistory: Content[] = history
    .slice(0, -1)
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
  const userText = history[history.length - 1].text

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))

      try {
        const chat = model.startChat({ history: chatHistory })
        let response = await chat.sendMessage(userText)

        for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
          const calls = response.response.functionCalls()
          if (!calls || calls.length === 0) break

          const parts = []
          for (const call of calls) {
            const label = TOOL_LABELS[call.name] ?? call.name
            const write = WRITE_TOOLS.has(call.name)
            emit({ type: "tool", name: call.name, label, write, status: "run" })

            const result = await executeTool(call.name, (call.args ?? {}) as Record<string, unknown>, ctx)
            const failed =
              typeof result.error === "string" &&
              Object.keys(result).length === 1

            emit({ type: "tool", name: call.name, label, write, status: failed ? "error" : "ok" })
            parts.push({ functionResponse: { name: call.name, response: result } })
          }

          response = await chat.sendMessage(parts)
        }

        const text = response.response.text()
        emit({
          type: "reply",
          text: text?.trim() || "Listo. ¿Necesitás algo más?",
        })
        emit({ type: "done" })
      } catch (err) {
        emit({
          type: "error",
          message:
            err instanceof Error && err.message.includes("429")
              ? "El servicio de IA está saturado. Probá de nuevo en un minuto."
              : "El asistente tuvo un problema. Probá de nuevo.",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  })
}
