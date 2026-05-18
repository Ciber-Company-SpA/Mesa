import { useState } from "react"

import { useCategories } from "@/hooks/useCategories"
import { useDeleteCategory } from "@/hooks/useDeleteCategory"
import type { Category } from "@/types/category"

export function useCategoryList() {
  const {
    categories,
    loading,
    error
  } = useCategories()

  const {
    deleteCategory,
    loading: deleting,
    error: deleteError,
    dialog: deleteDialog
  } = useDeleteCategory()

  const [deletedCategoryIds, setDeletedCategoryIds] = useState<number[]>([])

  const visibleCategories = (categories as Category[]).filter(
    (category) => !deletedCategoryIds.includes(category.id)
  )

  async function deleteVisibleCategory(categoryId: number) {
    const success = await deleteCategory(categoryId)

    if (success) {
      setDeletedCategoryIds((prev) => [...prev, categoryId])
    }

    return success
  }

  return {
    categories: visibleCategories,
    totalCategories: visibleCategories.length,
    loading,
    deleting,
    error: error ?? deleteError,
    deleteCategory: deleteVisibleCategory,
    deleteDialog
  }
}
