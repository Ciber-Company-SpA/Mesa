import { z } from "zod"

export const ProductOptionSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la opción es obligatorio"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  imageUrl: z.string().url().nullable(),
  imagePublicId: z.string().nullable(),
})

export type ProductOptionInput = z.infer<typeof ProductOptionSchema>

export const CreateProductSchema = z.object({
  name: z.string().trim().min(1, "El nombre del producto es obligatorio"),
  description: z.string().trim().nullable(),
  categoryId: z.number().int().positive("Debes seleccionar una categoría"),
  restaurantId: z.number().int().positive(),
  options: z.array(ProductOptionSchema).min(1, "Debe haber al menos una opción"),
})

export type CreateProductInput = z.infer<typeof CreateProductSchema>