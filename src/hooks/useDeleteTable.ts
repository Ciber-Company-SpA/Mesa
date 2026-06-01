import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { deleteTableAction } from "@/app/actions/table-actions"
import { invalidateTableCaches } from "@/lib/cache-invalidation"

type PendingDeleteTable = {
  tableId: number
  qrCodeId: number
}

export function useDeleteTable() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pendingDeleteRef = useRef<PendingDeleteTable | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const { run: deleteTableWithRetry, isPending } = useOfflineRetry(async () => {
    const pendingDelete = pendingDeleteRef.current
    if (!pendingDelete) return false

    const result = await deleteTableAction({
      tableId: pendingDelete.tableId,
      qrCodeId: pendingDelete.qrCodeId,
    })

    if (!result.ok) {
      throw new Error(result.error)
    }

    invalidateTableCaches()
    return true
  })

  async function deleteTable(tableId: number, qrCodeId: number) {
    return confirm({
      title: "¿Seguro que quieres eliminar esta mesa?",
      description: "La mesa y su código QR asociado se borrarán. Esta acción no se puede deshacer.",
      onConfirm: async () => {
        try {
          pendingDeleteRef.current = { tableId, qrCodeId }
          setLoading(true)
          setError("")

          return await deleteTableWithRetry()
        } catch (err: unknown) {
          handleMutationError(err, {
            logTag: "Error eliminando mesa",
            fallback: "Error al eliminar mesa",
            setError,
          })
          return false
        } finally {
          setLoading(false)
        }
      },
    })
  }

  return { deleteTable, loading: loading || isPending, error, dialog }
}