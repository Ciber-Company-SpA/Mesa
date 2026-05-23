import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { revalidateMenu } from "@/app/actions/revalidate-menu"
import { logger } from "@/lib/logger"
import { getSafeErrorMessage } from "@/lib/safe-error"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

const safeErrors = [
  "El nombre de la categoria es obligatorio",
  "Usuario no autenticado",
  "No se encontro el restaurante del usuario"
]

export function useCreateCategory() {
  const router = useRouter()
  const pendingNameRef = useRef("")

  const [categoryName, setCategoryName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const { run: createCategoryWithRetry, isPending } = useOfflineRetry(async () => {
    const cleanCategoryName = pendingNameRef.current.trim()

    if (!cleanCategoryName) {
      throw new Error("El nombre de la categoria es obligatorio")
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError) throw userError

    if (!user) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw { isNetworkError: true, message: "Sin conexion" }
      }

      throw new Error("Usuario no autenticado")
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("restaurant_id")
      .eq("auth_user_id", user.id)
      .single()

    if (profileError || !profile) {
      throw new Error("No se encontro el restaurante del usuario")
    }

    const { error: categoryError } = await supabase
      .from("categories")
      .insert({
        category_name: cleanCategoryName,
        restaurant_id: profile.restaurant_id
      })

    if (categoryError) throw categoryError
    await revalidateMenu()
    router.replace("/admin/categories")
  })

  async function createCategory(trimmedName: string) {
    if (loading) return

    try {
      pendingNameRef.current = trimmedName
      setLoading(true)
      setError("")

      await createCategoryWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return
      logger.error("Error creando categoria", err)
      setError(getSafeErrorMessage(err, "Error al crear categoria", safeErrors))
    } finally {
      setLoading(false)
    }
  }

  return {
    categoryName,
    setCategoryName,
    loading: loading || isPending,
    error,
    createCategory
  }
}
