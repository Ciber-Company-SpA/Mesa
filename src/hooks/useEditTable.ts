import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { decodeId } from "@/lib/hashids"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { getSafeErrorMessage } from "@/lib/safe-error"

const safeErrors = [
  "Mesa no encontrada",
  "El número de mesa debe ser mayor a 0"
]

export function useEditTable() {
  const router = useRouter()
  const params = useParams()

  const tableId = decodeId(params.id as string)

  const [tableNumber, setTableNumber] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadTable() {
      try {
        setLoading(true)
        setLoadError("")

        if (!tableId) throw new Error("Mesa no encontrada")

        const { data, error } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .maybeSingle()

        if (error) throw error
        if (!data) throw new Error("Mesa no encontrada")

        setTableNumber(String(data.table_number))
      } catch (err: unknown) {
        logger.error("Error cargando mesa", err)
        setLoadError(getSafeErrorMessage(err, "Error al cargar mesa", safeErrors))
      } finally {
        setLoading(false)
      }
    }

    loadTable()
  }, [tableId])

  async function updateTable() {
    if (saving) return

    try {
      setSaving(true)
      setError("")

      const cleanNumber = Number(tableNumber)

      if (!cleanNumber || cleanNumber <= 0) {
        throw new Error("El número de mesa debe ser mayor a 0")
      }

      const { error } = await supabase
        .from("tables")
        .update({ table_number: cleanNumber })
        .eq("id", tableId)

      if (error) throw error

      router.replace("/admin/tables")
    } catch (err: unknown) {
      logger.error("Error actualizando mesa", err)
      setError(getSafeErrorMessage(err, "Error al guardar cambios", safeErrors))
    } finally {
      setSaving(false)
    }
  }

  return {
    tableNumber,
    setTableNumber,
    loading,
    saving,
    loadError,
    error,
    updateTable
  }
}
