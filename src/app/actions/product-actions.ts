"use server"

import { revalidateTag } from "next/cache"
import { createProduct as createProductService, type CreatedProduct } from "@/services/product-service"
import type { CreateProductInput } from "@/lib/validation/product"
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