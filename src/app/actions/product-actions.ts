"use server"

import { revalidateTag } from "next/cache"
import {
  createProduct as createProductService,
  updateProduct as updateProductService,
  getProductForEdit as getProductForEditService,
  type CreatedProduct,
  type ProductForEdit,
} from "@/services/product-service"
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/lib/validation/product"
import type { Result } from "@/services/result"

export async function createProductAction(
  input: CreateProductInput
): Promise<Result<CreatedProduct>> {
  const result = await createProductService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}

export async function updateProductAction(
  input: UpdateProductInput
): Promise<Result<{ id: number }>> {
  const result = await updateProductService(input)

  if (result.ok) {
    revalidateTag("menu", "default")
  }

  return result
}

export async function getProductForEditAction(
  productId: number
): Promise<Result<ProductForEdit>> {
  return getProductForEditService(productId)
}