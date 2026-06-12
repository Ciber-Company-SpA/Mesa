// Edge Function: envía un push al mesero asignado a la mesa cuando el cliente
// pide la cuenta (insert en service_calls vía RPC request_bill).
//
// Flujo:
//  1. Recibe { service_call_id } por POST (la llama el trigger notify_service_call_push).
//  2. Busca la llamada + mesa + waiter actual + tokens FCM del waiter.
//  3. Envía el push a cada token. Si FCM devuelve UNREGISTERED, borra el token.
//
// Los helpers de FCM (JWT + OAuth) son los mismos de send-order-push — las
// edge functions son self-contained, así que se duplican a propósito.
//
// Secrets requeridos (compartidos con send-order-push):
//   FCM_SERVICE_ACCOUNT — JSON completo del service account de Firebase.
//
// Deploy: supabase functions deploy send-service-call-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const FCM_SERVICE_ACCOUNT_RAW = Deno.env.get("FCM_SERVICE_ACCOUNT")!

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
  token_uri: string
}

let cachedAccount: ServiceAccount | null = null
function getServiceAccount(): ServiceAccount {
  if (cachedAccount) return cachedAccount
  cachedAccount = JSON.parse(FCM_SERVICE_ACCOUNT_RAW) as ServiceAccount
  return cachedAccount
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60_000 > Date.now()) {
    return cachedAccessToken.token
  }
  const sa = getServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const jwt = await signJwt(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
  )

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`FCM token error: ${JSON.stringify(body)}`)
  cachedAccessToken = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  }
  return cachedAccessToken.token
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input)
  let str = ""
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, "")
  const raw = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

async function signJwt(payload: Record<string, unknown>, pem: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" }
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`
  const key = await importPrivateKey(pem)
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${base64UrlEncode(sig)}`
}

type ServiceCallInfo = {
  call_id: number
  diner_label: string | null
  table_number: number | null
  waiter_user_id: number | null
}

async function loadServiceCall(
  supa: ReturnType<typeof createClient>,
  callId: number,
): Promise<ServiceCallInfo | null> {
  const { data, error } = await supa
    .from("service_calls")
    .select("id, diner_label, tables(table_number, current_waiter_id)")
    .eq("id", callId)
    .maybeSingle()
  if (error || !data) return null
  const tablesRel = data.tables as
    | { table_number: number | null; current_waiter_id: number | null }
    | { table_number: number | null; current_waiter_id: number | null }[]
    | null
  const table = Array.isArray(tablesRel) ? tablesRel[0] : tablesRel
  return {
    call_id: data.id,
    diner_label: data.diner_label ?? null,
    table_number: table?.table_number ?? null,
    waiter_user_id: table?.current_waiter_id ?? null,
  }
}

async function loadTokens(
  supa: ReturnType<typeof createClient>,
  userId: number,
): Promise<{ id: number; token: string }[]> {
  const { data } = await supa
    .from("device_tokens")
    .select("id, token")
    .eq("user_id", userId)
  return data ?? []
}

async function sendFcm(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  callId: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          android: {
            priority: "HIGH",
            notification: {
              sound: "default",
              channel_id: "new-orders-v2",
            },
          },
          data: {
            service_call_id: String(callId),
            type: "service_call",
          },
        },
      }),
    },
  )
  if (res.ok) return { ok: true, status: res.status }
  const errBody = await res.text()
  return { ok: false, status: res.status, error: errBody }
}

Deno.serve(async (req) => {
  try {
    const { service_call_id } = await req.json()
    if (!service_call_id || typeof service_call_id !== "number") {
      return new Response(JSON.stringify({ error: "service_call_id requerido" }), { status: 400 })
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const call = await loadServiceCall(supa, service_call_id)
    if (!call) {
      return new Response(JSON.stringify({ error: "Llamada no encontrada" }), { status: 404 })
    }
    if (!call.waiter_user_id) {
      return new Response(JSON.stringify({ skipped: "Mesa sin mesero asignado" }), { status: 200 })
    }

    const tokens = await loadTokens(supa, call.waiter_user_id)
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: "Mesero sin tokens registrados" }), { status: 200 })
    }

    const sa = getServiceAccount()
    const accessToken = await getAccessToken()

    const tableLabel = call.table_number != null ? `Mesa ${call.table_number}` : "Una mesa"
    const title = `🧾 ${tableLabel} pide la cuenta`
    const body = call.diner_label ? `Lo pidió ${call.diner_label}` : "Acércate cuando puedas"

    const results: { token_id: number; ok: boolean; status: number; error?: string }[] = []
    for (const t of tokens) {
      const r = await sendFcm(accessToken, sa.project_id, t.token, title, body, call.call_id)
      results.push({ token_id: t.id, ...r })
      if (!r.ok && (r.status === 404 || r.error?.includes("UNREGISTERED") || r.error?.includes("INVALID_ARGUMENT"))) {
        await supa.from("device_tokens").delete().eq("id", t.id)
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
