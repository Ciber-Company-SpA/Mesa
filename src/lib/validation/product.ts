import { z } from "zod"



export const CreateProductOptionSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la opción es obligatorio"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  imageUrl: z.string().url().nullable(),
  imagePublicId: z.string().nullable(),
})

export type CreateProductOptionInput = z.infer<typeof CreateProductOptionSchema>

export const CreateProductSchema = z.object({
  name: z.string().trim().min(1, "El nombre del producto es obligatorio"),
  description: z.string().trim().nullable(),
  categoryId: z.number().int().positive("Debes seleccionar una categoría"),
  restaurantId: z.number().int().positive(),
  options: z.array(CreateProductOptionSchema).min(1, "Debe haber al menos una opción"),
})

export type CreateProductInput = z.infer<typeof CreateProductSchema>



export const UpdateProductOptionSchema = z.object({
  variantId: z.number().int().positive().optional(),
  name: z.string().trim().min(1, "El nombre de la opción es obligatorio"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  imageUrl: z.string().url().nullable(),
  imagePublicId: z.string().nullable(),
})

export type UpdateProductOptionInput = z.infer<typeof UpdateProductOptionSchema>

export const UpdateProductSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().trim().min(1, "El nombre del producto es obligatorio"),
  description: z.string().trim().nullable(),
  categoryId: z.number().int().positive("Debes seleccionar una categoría"),
  options: z.array(UpdateProductOptionSchema).min(1, "Debe haber al menos una opción"),
  initialVariantIds: z.array(z.number().int().positive()),
})

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>

export const DeleteProductSchema = z.object({
  productId: z.number().int().positive(),
  productImagePublicId: z.string().nullable().optional(),
})

export type DeleteProductInput = z.infer<typeof DeleteProductSchema>