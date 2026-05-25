import { useRef, useState } from "react"
import { useOfflineRetry } from "@/hooks/useOfflineRetry"
import { useConfirmDialog } from "@/hooks/useConfirmDialog"
import { handleMutationError } from "@/lib/hooks/handle-mutation-error"
import { deleteWaiterAction } from "@/app/actions/waiter-actions"

export function useDeleteWaiter() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pendingIdRef = useRef<number | null>(null)
  const { confirm, dialog } = useConfirmDialog()

  const { run: deleteWaiterWithRetry, isPending } = useOfflineRetry(async () => {
    const id = pendingIdRef.current
    if (!id) return false

    const result = await deleteWaiterAction(id)

    if (!result.ok) {
      throw new Error(result.error)
    }

    return true
  })

  async function deleteWaiter(waiterId: number, waiterName: string) {
    return confirm({
      title: `¿Eliminar a ${waiterName}?`,
      description: "El mesero se borrará del sistema y no podrá iniciar sesión. Esta acción no se puede deshacer.",
      onConfirm: async () => {
        try {
          pendingIdRef.current = waiterId
          setLoading(true)
          setError("")
          return await deleteWaiterWithRetry()
        } catch (err: unknown) {
          handleMutationError(err, {
            logTag: "Error eliminando mesero",
            fallback: "Error al eliminar mesero",
            setError,
          })
          return false
        } finally {
          setLoading(false)
        }
      },
    })
  }

  return { deleteWaiter, loading: loading || isPending, error, dialog }
}
