import { useCallback } from "react"
import { supabase } from "@/lib/supabase"
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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw userError
    if (!user) throw new Error("Usuario no autenticado")

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single()

    if (profileError) throw profileError

    const email = user.email ?? ""
    const metadataName =
      typeof user.user_metadata?.admin_name === "string"
        ? user.user_metadata.admin_name
        : ""
    const name = metadataName || email.split("@")[0] || "Admin"

    return {
      id: user.id,
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
