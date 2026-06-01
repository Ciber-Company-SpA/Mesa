import { useEffect, useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import {
  updateTableAction,
  getTableForEditAction,
} from "@/app/actions/table-actions"
import { invalidateTableCaches } from "@/lib/cache-invalidation"

export function useEditTable(tableId: number | null) {
  const pendingTableNumberRef = useRef("")
  const successRef = useRef(false)

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

    invalidateTableCaches()
    successRef.current = true
  })

  useEffect(() => {
    if (!tableId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal cerrado: no hay id, salimos del estado de carga inicial.
      setLoading(false)
      return
    }

    let cancelled = false
    async function loadTable() {
      try {
        setLoading(true)
        setLoadError("")
        await loadTableWithRetry()
      } catch (err: unknown) {
        if (cancelled) return
        handleMutationError(err, {
          logTag: "Error cargando mesa",
          fallback: "Error al cargar mesa",
          setError: setLoadError,
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadTable()
    return () => { cancelled = true }
  }, [tableId, loadTableWithRetry])

  async function updateTable(): Promise<boolean> {
    if (saving) return false

    successRef.current = false

    try {
      pendingTableNumberRef.current = tableNumber
      setSaving(true)
      setError("")
      await updateTableWithRetry()
      return successRef.current
    } catch (err: unknown) {
      handleMutationError(err, {
        logTag: "Error actualizando mesa",
        fallback: "Error al guardar cambios",
        setError,
      })
      return false
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
