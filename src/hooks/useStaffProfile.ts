import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { getSessionClaims } from "@/lib/supabase/claims"
import { useCache } from "@/hooks/useCache"
import { logger } from "@/lib/logger"
import {
  getAvatarGradient,
  roleIdToRole,
  type Staff,
} from "@/lib/waiter-session"

export function useStaffProfile() {
  const fetchProfile = useCallback(async (): Promise<Staff | null> => {
    const claims = await getSessionClaims(supabase)

    if (!claims) return null

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, user_name, role_id, restaurant_id")
      .eq("auth_user_id", claims.userId)
      .single()

    if (profileError) throw profileError
    if (!profile) return null

    const fallbackName =
      (typeof claims.userMetadata.admin_name === "string"
        ? claims.userMetadata.admin_name
        : null) ??
      claims.email?.split("@")[0] ??
      "Mesero"

    return {
      id: profile.id,
      name: profile.user_name ?? fallbackName,
      role: roleIdToRole(profile.role_id),
      restaurantId: profile.restaurant_id,
      avatar_color: getAvatarGradient(profile.id),
    }
  }, [])

  const { data, isLoading, isPendingRetry, error, refresh } = useCache<Staff | null>(
    "staff-profile",
    fetchProfile,
    { revalidateOnMount: true }
  )

  if (error) {
    logger.error("Error obteniendo perfil de staff", error)
  }

  return {
    profile: data,
    loading: isLoading || isPendingRetry,
    error: error ? "No se pudo obtener tu perfil" : "",
    refresh,
  }
}
