"use client"

import { usePathname, useRouter } from "next/navigation"

interface BackButtonProps {
  label?: string
  className?: string
  href?: string
}

export function BackButton({ label = "Volver", className, href }: BackButtonProps) {
  const pathname = usePathname()
  const router = useRouter()
  const defaultClassName =
    "inline-flex items-center rounded-full bg-white/10 px-5 py-3 text-sm font-black text-orange-100 shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/[0.14] hover:text-orange-200"

  const goBack = () => {
    if (href) {
      router.push(href)
      return
    }

    if (window.history.length > 1) {
      router.back()
      return
    }

    const parent = pathname.split("/").slice(0, -1).join("/") || "/"
    router.push(parent)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={className ?? defaultClassName}
    >
      {label}
    </button>
  )
}
