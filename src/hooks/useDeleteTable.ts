import { useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { isNetworkError, useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"

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

    const { error: tableError } = await supabase
      .from("tables")
      .delete()
      .eq("id", pendingDelete.tableId)

    if (tableError) throw tableError

    const { error: qrError } = await supabase
      .from("table_qr_codes")
      .delete()
      .eq("id", pendingDelete.qrCodeId)

    if (qrError) throw qrError

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
          if (isNetworkError(err)) return false
          logger.error("Error eliminando mesa", err)
          setError("Error al eliminar mesa")
          return false
        } finally {
          setLoading(false)
        }
      },
    })
  }

  return { deleteTable, loading: loading || isPending, error, dialog }
}
