import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { decodeId } from "@/lib/hashids"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { getSafeErrorMessage } from "@/lib/safe-error"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"

const safeErrors = [
  "Mesa no encontrada",
  "El numero de mesa debe ser mayor a 0"
]

export function useEditTable() {
  const router = useRouter()
  const params = useParams()
  const tableId = decodeId(params.id as string)
  const pendingTableNumberRef = useRef("")

  const [tableNumber, setTableNumber] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")

  const { run: loadTableWithRetry, isPending: isLoadPending } = useOfflineRetry(async () => {
    if (!tableId) throw new Error("Mesa no encontrada")

    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("Mesa no encontrada")

    setTableNumber(String(data.table_number))
    setLoadError("")
  })

  const { run: updateTableWithRetry, isPending: isSavePending } = useOfflineRetry(async () => {
    const cleanNumber = Number(pendingTableNumberRef.current)

    if (!cleanNumber || cleanNumber <= 0) {
      throw new Error("El numero de mesa debe ser mayor a 0")
    }

    const { error } = await supabase
      .from("tables")
      .update({ table_number: cleanNumber })
      .eq("id", tableId)

    if (error) throw error

    router.replace("/admin/tables")
  })

  useEffect(() => {
    async function loadTable() {
      try {
        setLoading(true)
        setLoadError("")
        await loadTableWithRetry()
      } catch (err: unknown) {
        if (isNetworkError(err)) return
        logger.error("Error cargando mesa", err)
        setLoadError(getSafeErrorMessage(err, "Error al cargar mesa", safeErrors))
      } finally {
        setLoading(false)
      }
    }

    loadTable()
  }, [loadTableWithRetry])

  async function updateTable() {
    if (saving) return

    try {
      pendingTableNumberRef.current = tableNumber
      setSaving(true)
      setError("")
      await updateTableWithRetry()
    } catch (err: unknown) {
      if (isNetworkError(err)) return
      logger.error("Error actualizando mesa", err)
      setError(getSafeErrorMessage(err, "Error al guardar cambios", safeErrors))
    } finally {
      setSaving(false)
    }
  }

  return {
    tableNumber,
    setTableNumber,
    loading: loading || isLoadPending,
    saving: saving || isSavePending,
    loadError,
    error,
    updateTable
  }
}
