import { useState } from "react"
import { useTables } from "@/hooks/useTables"
import { useDeleteTable } from "@/hooks/useDeleteTable"

type UseTableListOptions = {
  page?: number
  pageSize?: number
}

export function useTableList({ page = 1, pageSize = 12 }: UseTableListOptions = {}) {
  const { tables, total, loading, error, refresh } = useTables({ page, pageSize })
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
  const optimisticDeletedCount = tables.filter((table) =>
    deletedTableIds.includes(table.id)
  ).length
  const totalVisibleTables = Math.max(0, total - optimisticDeletedCount)

  async function deleteVisibleTable(tableId: number, qrCodeId: number) {
    const success = await deleteTable(tableId, qrCodeId)

    if (success) {
      setDeletedTableIds((prev) =>
        prev.includes(tableId) ? prev : [...prev, tableId]
      )
      refresh()
    }

    return success
  }

  return {
    tables: visibleTables,
    totalTables: totalVisibleTables,
    totalPages: Math.max(1, Math.ceil(totalVisibleTables / pageSize)),
    loading,
    deleting,
    error: error || deleteError,
    deleteTable: deleteVisibleTable,
    deleteDialog,
  }
}
