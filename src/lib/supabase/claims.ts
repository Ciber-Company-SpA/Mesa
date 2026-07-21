import type { SupabaseClient } from "@supabase/supabase-js"

export type SessionClaims = {
  /** auth.users.id (JWT `sub`) — reemplaza a user.id de getUser(). */
  userId: string
  /** Correo del usuario, si el JWT lo trae. */
  email: string | null
  /** user_metadata del JWT (p. ej. admin_name). */
  userMetadata: Record<string, unknown>
}

/**
 * Lee la identidad del usuario desde el JWT verificándolo LOCALMENTE contra la
 * JWKS cacheada (claves asimétricas ES256, caché global a nivel de módulo en
 * auth-js): NO hace ida y vuelta al servidor de Auth en cada request. Solo pega
 * a la red cuando el token expiró y hay que refrescarlo (y en ese caso rota las
 * cookies de sesión por los callbacks del cliente, igual que getUser()).
 *
 * Reemplaza a `auth.getUser()`, que SIEMPRE hace un round-trip a /auth/v1/user.
 * Es el mismo patrón ya validado en el portal (getClaims con claves ES256).
 *
 * Trade-off aceptado (idéntico al del portal): getClaims no detecta revocación
 * server-side de la sesión. La autorización real sigue en las RPC/policies con
 * guard, que corren en PostgREST y validan la firma del JWT (auth.uid()).
 * Devuelve null si no hay sesión válida o el JWT no verifica.
 */
export async function getSessionClaims(
  supabase: SupabaseClient
): Promise<SessionClaims | null> {
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    userMetadata:
      claims.user_metadata && typeof claims.user_metadata === "object"
        ? (claims.user_metadata as Record<string, unknown>)
        : {},
  }
}
