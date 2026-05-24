import { z } from "zod"

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1, "El nombre de la categoría es obligatorio"),
  restaurantId: z.number().int().positive(),
})

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>



export const UpdateCategorySchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1, "El nombre de la categoría es obligatorio"),
})

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>


export const DeleteCategorySchema = z.object({
  categoryId: z.number().int().positive(),
})

export type DeleteCategoryInput = z.infer<typeof DeleteCategorySchema>