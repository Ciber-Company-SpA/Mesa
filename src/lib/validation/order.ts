import { z } from "zod"




export const CreateOrderItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
 
  productQuantity: z
    .number()
    .int()
    .min(1, "La cantidad debe ser mayor a 0")
    .max(20, "Cantidad máxima por ítem: 20"),
 
  notes: z.string().trim().max(250, "La nota es demasiado larga").nullable().optional(),
})

export type CreateOrderItemInput = z.infer<typeof CreateOrderItemSchema>


export const CreateOrderSchema = z.object({
  tableId: z.number().int().positive(),
  dinerToken: z.string().min(8).max(128).nullable().optional(),
  items: z
    .array(CreateOrderItemSchema)
    .min(1, "Debe haber al menos un item en el pedido")
    .max(30, "Demasiados ítems en un solo pedido (máximo 30)"),
})

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>