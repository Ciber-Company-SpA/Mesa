import { useState } from "react"
import { useTables } from "@/hooks/useTables"
import { useDeleteTable } from "@/hooks/useDeleteTable"

export function useTableList() {
  const { tables, loading, error } = useTables()
  const {
    deleteTable,
    loading: deleting,
    error: deleteError,
    dialog: deleteDialog,
  } = useDeleteTable()

  const [deletedTableIds, setDeletedTableIds] = useState<number[]>([])

  const visibleTables = tables.filter(
    (table) => !deletedTableIds.includes(table.id)
  )

  async function deleteVisibleTable(tableId: number, qrCodeId: number) {
    const success = await deleteTable(tableId, qrCodeId)

    if (success) {
      setDeletedTableIds((prev) => [...prev, tableId])
    }

    return success
  }

  return {
    tables: visibleTables,
    totalTables: visibleTables.length,
    loading,
    deleting,
    error: error || deleteError,
    deleteTable: deleteVisibleTable,
    deleteDialog,
  }
}
