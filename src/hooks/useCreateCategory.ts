import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { getSafeErrorMessage } from "@/lib/safe-error"

const safeErrors = [
  "El nombre de la categoría es obligatorio",
  "Usuario no autenticado",
  "No se encontró el restaurante del usuario"
]

export function useCreateCategory() {
  const router = useRouter()

  const [categoryName, setCategoryName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function createCategory(trimmedName: string) {
    if (loading) return

    try {
      setLoading(true)
      setError("")

      const cleanCategoryName = trimmedName.trim()

      if (!cleanCategoryName) {
        throw new Error("El nombre de la categoría es obligatorio")
      }

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Usuario no autenticado")
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("restaurant_id")
        .eq("auth_user_id", user.id)
        .single()

      if (profileError || !profile) {
        throw new Error("No se encontró el restaurante del usuario")
      }

      const { error: categoryError } = await supabase
        .from("categories")
        .insert({
          category_name: cleanCategoryName,
          restaurant_id: profile.restaurant_id
        })

      if (categoryError) throw categoryError

      router.replace("/admin/categories")
    } catch (err: unknown) {
      logger.error("Error creando categoría", err)
      setError(getSafeErrorMessage(err, "Error al crear categoría", safeErrors))
    } finally {
      setLoading(false)
    }
  }

  return {
    categoryName,
    setCategoryName,
    loading,
    error,
    createCategory
  }
}
