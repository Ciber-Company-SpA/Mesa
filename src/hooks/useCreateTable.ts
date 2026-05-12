import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { useRestaurantId } from "@/hooks/useRestaurantId"
import { nanoid } from "nanoid"

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  return fallback
}

export function useCreateTable() {
  const router = useRouter()
  const { restaurantId, loading: loadingId } = useRestaurantId()

  const [tableNumber, setTableNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function createTable() {
    if (loading || loadingId) return

    try {
      setLoading(true)
      setError("")

      const cleanNumber = Number(tableNumber)

      if (!cleanNumber || cleanNumber <= 0) {
        throw new Error("El número de mesa debe ser mayor a 0")
      }

      if (!restaurantId) {
        throw new Error("No se encontró el restaurante")
      }

      const { data: { session } } = await supabase.auth.getSession()
      console.log("token:", session?.access_token)

      if (!session) {
        throw new Error("No hay sesión activa")
      }

      const { data: qrData, error: qrError } = await supabase
        .from("qr_codes")
        .insert({
          qr_code: nanoid(8),
          qr_active: true
        })
        .select()
        .single()

      if (qrError) throw new Error(qrError.message)

      const { error: tableError } = await supabase
        .from("tables")
        .insert({
          table_number: cleanNumber,
          restaurant_id: restaurantId,
          qr_code_id: qrData.id
        })

      if (tableError) throw new Error(tableError.message)

      router.replace("/admin/tables")
    } catch (err: unknown) {
      logger.error("Error creando mesa", err)
      setError(getErrorMessage(err, "Error al crear mesa"))
    } finally {
      setLoading(false)
    }
  }

  return {
    tableNumber,
    setTableNumber,
    loading,
    error,
    createTable
  }
}