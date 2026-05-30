import { z } from "zod"

// ============ CREATE ORDER ============

// El cliente SOLO envía qué producto y cuántos. El servidor lee
// nombre y precio reales desde la DB para evitar manipulación.
export const CreateOrderItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  productQuantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
  notes: z.string().trim().nullable().optional(),
})

export type CreateOrderItemInput = z.infer<typeof CreateOrderItemSchema>

// El servidor deriva restaurantId del tableId. No confiamos en el cliente.
export const CreateOrderSchema = z.object({
  tableId: z.number().int().positive(),
  items: z.array(CreateOrderItemSchema).min(1, "Debe haber al menos un item en el pedido"),
})

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>