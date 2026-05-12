"use client"

import { useState } from "react"

import { useCategories } from "@/hooks/useCategories"
import { useDeleteCategory } from "@/hooks/useDeleteCategory"

export type Category = {
  id: number
  category_name: string
}

export function useCategoryList() {
  const {
    categories,
    loading,
    error
  } = useCategories()

  const {
    deleteCategory,
    loading: deleting,
    error: deleteError
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
    error: error || deleteError,
    deleteCategory: deleteVisibleCategory
  }
}
