"use server"

import { revalidateTag } from "next/cache"
import {
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
  getCategoryForEdit as getCategoryForEditService,
  type CreatedCategory,
  type CategoryForEdit,
} from "@/services/category-service"
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  DeleteCategoryInput,
} from "@/lib/validation/category"
import type { Result } from "@/services/result"

export async function createCategoryAction(
  input: CreateCategoryInput
): Promise<Result<CreatedCategory>> {
  const result = await createCategoryService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}

export async function updateCategoryAction(
  input: UpdateCategoryInput
): Promise<Result<{ id: number }>> {
  const result = await updateCategoryService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}

export async function deleteCategoryAction(
  input: DeleteCategoryInput
): Promise<Result<{ id: number }>> {
  const result = await deleteCategoryService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}

export async function getCategoryForEditAction(
  categoryId: number
): Promise<Result<CategoryForEdit>> {
  return getCategoryForEditService(categoryId)
}