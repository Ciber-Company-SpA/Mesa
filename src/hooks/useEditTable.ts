import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { decodeId } from "@/lib/hashids"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import {
  updateTableAction,
  getTableForEditAction,
} from "@/app/actions/table-actions"

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

    const result = await getTableForEditAction(tableId)

    if (!result.ok) {
      throw new Error(result.error)
    }

    setTableNumber(String(result.data.tableNumber))
    setLoadError("")
  })

  const { run: updateTableWithRetry, isPending: isSavePending } = useOfflineRetry(async () => {
    if (!tableId) throw new Error("Mesa no encontrada")

    const result = await updateTableAction({
      tableId,
      tableNumber: Number(pendingTableNumberRef.current),
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    router.replace("/admin/tables")
  })

  useEffect(() => {
    async function loadTable() {
      try {
        setLoading(true)
        setLoadError("")
        await loadTableWithRetry()
      } catch (err: unknown) {
        handleMutationError(err, {
          logTag: "Error cargando mesa",
          fallback: "Error al cargar mesa",
          setError: setLoadError,
        })
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
      handleMutationError(err, {
        logTag: "Error actualizando mesa",
        fallback: "Error al guardar cambios",
        setError,
      })
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
    updateTable,
  }
}