export type ProductOptionForm = {
  localId: string
  variantId?: number
  name: string
  price: string
  imageFile: File | null
  imageUrl: string | null
  imagePublicId: string | null
}
