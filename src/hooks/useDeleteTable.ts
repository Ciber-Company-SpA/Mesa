import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export function useDeleteTable() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function deleteTable(tableId: number, qrCodeId: number) {
    const confirmed = confirm("¿Seguro que quieres eliminar esta mesa?")
    if (!confirmed) return false

    try {
      setLoading(true)
      setError("")

      // 1. Borrar mesa
      const { error: tableError } = await supabase
        .from("tables")
        .delete()
        .eq("id", tableId)

      if (tableError) throw tableError

      // 2. Borrar QR asociado
      const { error: qrError } = await supabase
        .from("qr_codes")
        .delete()
        .eq("id", qrCodeId)

      if (qrError) throw qrError

      return true
    } catch (err) {
      logger.error("Error eliminando mesa", err)
      setError(err instanceof Error ? err.message : "Error al eliminar mesa")
      return false
    } finally {
      setLoading(false)
    }
  }

  return { deleteTable, loading, error }
}