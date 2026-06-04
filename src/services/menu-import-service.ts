"use server"

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import { z } from "zod"
import { requireCurrentAdmin } from "@/services/auth-guard"
import { ok, fail, type Result } from "@/services/result"

// ============ TYPES ============

const ParsedVariantSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z.number().int().nonnegative(),
})

const ParsedProductSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.number().int().nonnegative(),
  category_name: z.string().trim().min(1).max(60),
  variants: z.array(ParsedVariantSchema).max(20).default([]),
})

const ParsedMenuSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(60)).max(40),
  products: z.array(ParsedProductSchema).max(200),
})

export type ParsedMenu = z.infer<typeof ParsedMenuSchema>
export type ParsedProduct = z.infer<typeof ParsedProductSchema>

// ============ PARSE (Gemini Vision) ============

const ParseInputSchema = z.object({
  images: z
    .array(
      z.object({
        mimeType: z.string().regex(/^image\//, "Tipo inválido"),
        base64: z.string().min(1),
      })
    )
    .min(1, "Subí al menos una imagen")
    .max(6, "Máximo 6 imágenes por carta"),
})

export type ParseInput = z.infer<typeof ParseInputSchema>

const SYSTEM_PROMPT = `Sos un asistente que extrae datos estructurados de una carta de restaurante chileno.

REGLAS IMPORTANTES:
- Devolvé SOLO los productos visibles en la imagen. No inventes nada.
- Los precios están en pesos chilenos (CLP). Devolvelos como ENTEROS sin puntos, comas ni símbolo. Ej: "$8.990" → 8990.
- Si un producto tiene múltiples tamaños/variantes con distinto precio (ej. "Pizza Chica $X / Mediana $Y / Grande $Z"), creá UN solo producto con sus variantes. NO crees productos separados.
- En ese caso, el "price" del producto debe ser igual al precio de la primera variante (servirá de fallback).
- Si un producto NO tiene variantes, dejá "variants" como [].
- Si no hay descripción visible, dejá "description" como null.
- Agrupá productos en categorías ya sea por los títulos de la carta o, si no los hay, por tipo (Entradas, Platos, Bebidas, Postres, etc).
- "category_name" de cada producto debe coincidir EXACTAMENTE con alguno de los strings en "categories".
- Mantené nombres de productos breves (idealmente bajo 50 caracteres). Cortá títulos demasiado largos.`

export async function parseMenuImage(input: ParseInput): Promise<Result<ParsedMenu>> {
  const parsed = ParseInputSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return fail("GEMINI_API_KEY no configurada en el server")

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            categories: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            products: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING, nullable: true },
                  price: { type: SchemaType.INTEGER },
                  category_name: { type: SchemaType.STRING },
                  variants: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        name: { type: SchemaType.STRING },
                        price: { type: SchemaType.INTEGER },
                      },
                      required: ["name", "price"],
                    },
                  },
                },
                required: ["name", "price", "category_name", "variants"],
              },
            },
          },
          required: ["categories", "products"],
        },
      },
    })

    const imageParts = parsed.data.images.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    }))

    const result = await model.generateContent([
      ...imageParts,
      { text: "Extraé las categorías y productos de esta carta." },
    ])

    const text = result.response.text()
    const json = JSON.parse(text)

    const validated = ParsedMenuSchema.safeParse(json)
    if (!validated.success) {
      return fail("La IA devolvió un formato inesperado. Probá con otra imagen.")
    }

    return ok(validated.data)
  } catch (err) {
    return fail(
      err instanceof Error
        ? `Error al procesar la imagen: ${err.message}`
        : "Error al procesar la imagen"
    )
  }
}

// ============ BULK INSERT ============

export type ImportSummary = {
  categoriesCreated: number
  categoriesReused: number
  productsCreated: number
  variantsCreated: number
  imagesFound: number
  skipped: string[]
}

// Busca una foto stock en Pexels que matchee con el nombre del producto.
// Devuelve null si no hay match, falla la red, o no hay API key configurada.
async function fetchPexelsImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  const cleaned = query.trim().toLowerCase()
  if (!cleaned) return null

  // "food" como hint para sesgar hacia fotos de comida y no fotos genéricas.
  const searchQuery = `${cleaned} food`

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=square`,
      { headers: { Authorization: apiKey }, cache: "no-store" }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      photos?: Array<{ src?: { medium?: string; large?: string } }>
    }
    const photo = data.photos?.[0]
    return photo?.src?.large ?? photo?.src?.medium ?? null
  } catch {
    return null
  }
}

export async function bulkImportMenu(input: ParsedMenu): Promise<Result<ImportSummary>> {
  const parsed = ParsedMenuSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const auth = await requireCurrentAdmin()
  if (!auth.ok) return fail(auth.error)

  const { supabase, restaurantId } = auth.data

  const summary: ImportSummary = {
    categoriesCreated: 0,
    categoriesReused: 0,
    productsCreated: 0,
    variantsCreated: 0,
    imagesFound: 0,
    skipped: [],
  }

  // Buscar fotos de Pexels en paralelo para todos los productos antes del insert.
  // Es más rápido que hacerlo dentro del loop secuencial y aprovecha el rate limit.
  const productImages = await Promise.all(
    parsed.data.products.map((p) => fetchPexelsImage(p.name))
  )

  // 1) Leer categorías existentes del restaurante (case-insensitive match por nombre).
  const { data: existingCategories, error: catError } = await supabase
    .from("categories")
    .select("id, category_name")
    .eq("restaurant_id", restaurantId)

  if (catError) return fail("No se pudo leer las categorías existentes")

  const categoryByName = new Map<string, number>()
  for (const cat of existingCategories ?? []) {
    categoryByName.set(cat.category_name.trim().toLowerCase(), cat.id)
  }

  // 2) Crear las categorías que no existan (case-insensitive).
  const inputCategories = new Set(parsed.data.categories.map((c) => c.trim()))
  for (const product of parsed.data.products) {
    inputCategories.add(product.category_name.trim())
  }

  for (const catName of inputCategories) {
    const key = catName.toLowerCase()
    if (categoryByName.has(key)) {
      summary.categoriesReused += 1
      continue
    }
    const { data: inserted, error } = await supabase
      .from("categories")
      .insert({ category_name: catName, restaurant_id: restaurantId })
      .select("id")
      .single()

    if (error || !inserted) {
      summary.skipped.push(`Categoría: ${catName}`)
      continue
    }
    categoryByName.set(key, inserted.id)
    summary.categoriesCreated += 1
  }

  // 3) Insertar productos (status_id=1 disponible) y sus variantes.
  for (let i = 0; i < parsed.data.products.length; i += 1) {
    const product = parsed.data.products[i]
    const categoryId = categoryByName.get(product.category_name.trim().toLowerCase())
    if (!categoryId) {
      summary.skipped.push(`Producto sin categoría válida: ${product.name}`)
      continue
    }

    const imageUrl = productImages[i]
    if (imageUrl) summary.imagesFound += 1

    const { data: insertedProduct, error: productError } = await supabase
      .from("products")
      .insert({
        product_name: product.name,
        product_description: product.description ?? null,
        product_price: product.price,
        product_image: imageUrl,
        product_image_public_id: null,
        category_id: categoryId,
        restaurant_id: restaurantId,
        status_id: 1,
      })
      .select("id")
      .single()

    if (productError || !insertedProduct) {
      summary.skipped.push(`Producto: ${product.name}`)
      continue
    }
    summary.productsCreated += 1

    if (product.variants.length > 0) {
      const variantsPayload = product.variants.map((v) => ({
        product_id: insertedProduct.id,
        variant_name: v.name,
        variant_price: v.price,
        variant_image: null,
        variant_image_public_id: null,
      }))

      const { error: variantsError } = await supabase
        .from("product_variants")
        .insert(variantsPayload)

      if (variantsError) {
        summary.skipped.push(`Variantes de: ${product.name}`)
      } else {
        summary.variantsCreated += product.variants.length
      }
    }
  }

  return ok(summary)
}
