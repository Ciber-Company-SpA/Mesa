import { useState } from "react"
import { useCategories } from "@/hooks/useCategories"
import { useDeleteCategory } from "@/hooks/useDeleteCategory"

type UseCategoryListOptions = {
  page?: number
  pageSize?: number
}

export function useCategoryList({ page = 1, pageSize = 12 }: UseCategoryListOptions = {}) {
  const {
    categories,
    total,
    loading,
    error,
    refresh,
  } = useCategories({ page, pageSize })

  const {
    deleteCategory,
    loading: deleting,
    error: deleteError,
    dialog: deleteDialog
  } = useDeleteCategory()

  const [deletedCategoryIds, setDeletedCategoryIds] = useState<number[]>([])

  const visibleCategories = categories.filter(
    (category) => !deletedCategoryIds.includes(category.id)
  )

  async function deleteVisibleCategory(categoryId: number) {
    const success = await deleteCategory(categoryId)

    if (success) {
      setDeletedCategoryIds((prev) => [...prev, categoryId])
      refresh()
    }

    return success
  }

  return {
    categories: visibleCategories,
    totalCategories: total - deletedCategoryIds.length,
    totalPages: Math.max(1, Math.ceil((total - deletedCategoryIds.length) / pageSize)),
    loading,
    deleting,
    error: error ?? deleteError,
    deleteCategory: deleteVisibleCategory,
    deleteDialog
  }
}