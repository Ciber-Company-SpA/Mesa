import { useMemo, useState } from "react"

interface Product {
  id: number
  category_id: number
  status_id: number
}

export function useFilteredProducts<T extends Product>(products: T[]) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) => p.status_id !== 3 && (selectedCategory === null || p.category_id === selectedCategory)
      ),
    [products, selectedCategory]
  )

  return { filteredProducts, selectedCategory, setSelectedCategory }
}