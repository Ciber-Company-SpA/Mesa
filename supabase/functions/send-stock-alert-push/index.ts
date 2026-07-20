// Edge Function: envía push notifications al/los ADMIN(es) de un restaurante
// cuando un insumo cruza a un nivel de alerta (bajo el mínimo o sin stock).
//
// Flujo:
//  1. Recibe { ingredient_id } por POST (lo dispara el trigger trg_stock_alert_push).
//  2. Busca el insumo + restaurante + usuarios admin (role_id = 2) + sus tokens FCM.
//  3. Firma un JWT con el service account de Firebase para autenticar a FCM v1.
//  4. Envía el push a cada token. Si FCM devuelve UNREGISTERED, borra el token.
//
// Es INOFENSIVO mientras el admin no tenga tokens registrados (skip 200): el
// registro de token del panel admin (Web Push) se activa al configurar Firebase.
//
// Secrets requeridos (supabase secrets set ...):
//   FCM_SERVICE_ACCOUNT — JSON completo del service account de Firebase.

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

// Cache del OAuth2 access token entre invocaciones cálidas.
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

type IngredientInfo = {
  ingredient_id: number
  name: string
  unit: string
  stock_actual: number
  stock_minimo: number
  restaurant_id: number
}

async function loadIngredient(
  supa: ReturnType<typeof createClient>,
  ingredientId: number,
): Promise<IngredientInfo | null> {
  const { data, error } = await supa
    .from("ingredients")
    .select("id, name, unit, stock_actual, stock_minimo, restaurant_id")
    .eq("id", ingredientId)
    .maybeSingle()
  if (error || !data) return null
  return {
    ingredient_id: data.id as number,
    name: (data.name as string) ?? "Insumo",
    unit: (data.unit as string) ?? "unidad",
    stock_actual: Number(data.stock_actual ?? 0),
    stock_minimo: Number(data.stock_minimo ?? 0),
    restaurant_id: data.restaurant_id as number,
  }
}

// Tokens de TODOS los usuarios admin (role_id = 2) del restaurante.
async function loadAdminTokens(
  supa: ReturnType<typeof createClient>,
  restaurantId: number,
): Promise<{ id: number; token: string }[]> {
  const { data: admins } = await supa
    .from("users")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("role_id", 2)
  const adminIds = (admins ?? []).map((u) => u.id as number)
  if (adminIds.length === 0) return []

  const { data } = await supa
    .from("device_tokens")
    .select("id, token")
    .in("user_id", adminIds)
  return data ?? []
}

async function sendFcm(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  ingredientId: number,
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
              channel_id: "stock-alerts-v1",
            },
          },
          webpush: {
            notification: {
              title,
              body,
              icon: "/icons/icon-192.png",
            },
            fcm_options: {
              link: "/admin/inventory",
            },
          },
          data: {
            ingredient_id: String(ingredientId),
            type: "stock_alert",
          },
        },
      }),
    },
  )
  if (res.ok) return { ok: true, status: res.status }
  const errBody = await res.text()
  return { ok: false, status: res.status, error: errBody }
}

function formatStock(value: number, unit: string): string {
  if (unit === "g" && Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString("es-CL")} kg`
  if (unit === "ml" && Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString("es-CL")} L`
  const label = unit === "unidad" ? "u" : unit
  return `${value.toLocaleString("es-CL")} ${label}`
}

Deno.serve(async (req) => {
  try {
    const { ingredient_id } = await req.json()
    if (!ingredient_id || typeof ingredient_id !== "number") {
      return new Response(JSON.stringify({ error: "ingredient_id requerido" }), { status: 400 })
    }

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ing = await loadIngredient(supa, ingredient_id)
    if (!ing) {
      return new Response(JSON.stringify({ error: "Insumo no encontrado" }), { status: 404 })
    }

    const tokens = await loadAdminTokens(supa, ing.restaurant_id)
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: "Admin sin tokens registrados" }), { status: 200 })
    }

    const sa = getServiceAccount()
    const accessToken = await getAccessToken()

    const isOut = ing.stock_actual <= 0
    const title = isOut ? `⚠️ Sin stock: ${ing.name}` : `⚠️ Stock bajo: ${ing.name}`
    const body = isOut
      ? "Se agotó este insumo. Repón para no interrumpir las ventas."
      : `Quedan ${formatStock(ing.stock_actual, ing.unit)} (mín ${formatStock(ing.stock_minimo, ing.unit)}).`

    const results: { token_id: number; ok: boolean; status: number; error?: string }[] = []
    for (const t of tokens) {
      const r = await sendFcm(accessToken, sa.project_id, t.token, title, body, ing.ingredient_id)
      results.push({ token_id: t.id, ...r })
      // Si FCM dice que el token ya no es válido, lo borramos.
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
