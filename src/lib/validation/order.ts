import { z } from "zod"

// ============ CREATE ORDER ============

// Schema para un item del pedido (lo que va dentro del array)
export const CreateOrderItemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().trim().min(1, "El nombre del producto es obligatorio"),
  productPrice: z.number().nonnegative("El precio debe ser mayor o igual a 0"),
  productQuantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
  notes: z.string().trim().nullable().optional(),
})

export type CreateOrderItemInput = z.infer<typeof CreateOrderItemSchema>

// Schema para crear el pedido completo
export const CreateOrderSchema = z.object({
  tableId: z.number().int().positive(),
  restaurantId: z.number().int().positive(),
  items: z.array(CreateOrderItemSchema).min(1, "Debe haber al menos un item en el pedido"),
})

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>