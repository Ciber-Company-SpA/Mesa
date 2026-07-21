import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { getSessionClaims } from "@/lib/supabase/claims"
import { useCache } from "@/hooks/useCache"
import { logger } from "@/lib/logger"
import type { AdminProfile } from "@/types/admin-profile"

function getInitials(nameOrEmail: string) {
  const cleanValue = nameOrEmail.trim()
  if (!cleanValue) return "A"

  const nameParts = cleanValue
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }

  return cleanValue.slice(0, 2).toUpperCase()
}

export function useAdminProfile() {
  const fetchAdminProfile = useCallback(async (): Promise<AdminProfile> => {
    const claims = await getSessionClaims(supabase)

    if (!claims) throw new Error("Usuario no autenticado")

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("auth_user_id", claims.userId)
      .single()

    if (profileError) throw profileError

    const email = claims.email ?? ""
    const metadataName =
      typeof claims.userMetadata.admin_name === "string"
        ? claims.userMetadata.admin_name
        : ""
    const name = metadataName || email.split("@")[0] || "Admin"

    return {
      id: claims.userId,
      email,
      name,
      initials: getInitials(name || email),
      restaurantId: profile.restaurant_id,
    }
  }, [])

  const { data, isLoading, isPendingRetry, error } = useCache<AdminProfile>(
    "admin-profile",
    fetchAdminProfile,
    { revalidateOnMount: true }
  )

  if (error) {
    logger.error("Error obteniendo perfil admin", error)
  }

  return {
    profile: data,
    loading: isLoading || isPendingRetry,
    error: error ? "No se pudo obtener el perfil" : "",
  }
}
