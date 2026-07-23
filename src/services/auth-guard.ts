import "server-only"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSessionClaims } from "@/lib/supabase/claims"
import { ok, fail, type Result } from "@/services/result"
import type { SupabaseClient } from "@supabase/supabase-js"

export const WAITER_ROLE_ID = 1
export const ADMIN_ROLE_ID = 2

type AuthContext = {
  supabase: SupabaseClient
  userId: string
  roleId: number
}

type AdminContext = AuthContext & { restaurantId: number }

export async function requireAdminForRestaurant(
  restaurantId: number
): Promise<Result<AuthContext>> {
  return requireRoleForRestaurant(restaurantId, [ADMIN_ROLE_ID])
}

export async function requireStaffForRestaurant(
  restaurantId: number
): Promise<Result<AuthContext>> {
  return requireRoleForRestaurant(restaurantId, [WAITER_ROLE_ID, ADMIN_ROLE_ID])
}

export async function requireCurrentAdmin(): Promise<Result<AdminContext>> {
  const supabase = await createSupabaseServerClient()

  const claims = await getSessionClaims(supabase)

  if (!claims) return fail("No autorizado")

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("restaurant_id, role_id")
    .eq("auth_user_id", claims.userId)
    .single()

  if (profileError || !profile) return fail("Perfil no encontrado")
  if (profile.role_id !== ADMIN_ROLE_ID) return fail("Acceso restringido")
  if (!profile.restaurant_id) return fail("Perfil sin restaurante")

  return ok({
    supabase,
    userId: claims.userId,
    roleId: profile.role_id,
    restaurantId: profile.restaurant_id,
  })
}

/** Staff que puede cobrar (mesero o admin), con su restaurante de sesión. */
export async function requireCurrentStaff(): Promise<Result<AdminContext>> {
  const supabase = await createSupabaseServerClient()

  const claims = await getSessionClaims(supabase)

  if (!claims) return fail("No autorizado")

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("restaurant_id, role_id")
    .eq("auth_user_id", claims.userId)
    .single()

  if (profileError || !profile) return fail("Perfil no encontrado")
  if (![WAITER_ROLE_ID, ADMIN_ROLE_ID].includes(profile.role_id)) {
    return fail("Acceso restringido")
  }
  if (!profile.restaurant_id) return fail("Perfil sin restaurante")

  return ok({
    supabase,
    userId: claims.userId,
    roleId: profile.role_id,
    restaurantId: profile.restaurant_id,
  })
}

async function requireRoleForRestaurant(
  restaurantId: number,
  allowedRoleIds: number[]
): Promise<Result<AuthContext>> {
  if (!restaurantId || restaurantId <= 0) {
    return fail("Restaurante inválido")
  }

  const supabase = await createSupabaseServerClient()

  const claims = await getSessionClaims(supabase)

  if (!claims) return fail("No autorizado")

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("restaurant_id, role_id")
    .eq("auth_user_id", claims.userId)
    .single()

  if (profileError || !profile) return fail("Perfil no encontrado")
  if (!allowedRoleIds.includes(profile.role_id)) return fail("Acceso restringido")
  if (profile.restaurant_id !== restaurantId) {
    return fail("No tienes permiso sobre este restaurante")
  }

  return ok({ supabase, userId: claims.userId, roleId: profile.role_id })
}