import Link from "next/link"
import Image from "next/image"
import mesaLogo from "@/image/MESA.svg"

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-stone-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="flex h-12 w-28 items-center overflow-hidden"
          aria-label="MESA inicio"
        >
          <Image
            src={mesaLogo}
            alt="MESA"
            className="h-full w-full scale-[1.75] object-contain object-center"
            priority
          />
        </Link>

        <nav className="flex items-center gap-1 text-sm font-semibold text-stone-700 sm:gap-3">
          <Link
            href="/"
            className="hidden rounded-full px-3 py-1.5 transition hover:bg-stone-100 sm:inline"
          >
            Restaurantes
          </Link>
          <Link
            href="/sumate"
            className="hidden rounded-full px-3 py-1.5 transition hover:bg-stone-100 sm:inline"
          >
            Sumá tu local
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-stone-950 px-4 py-2 text-white shadow-sm transition hover:bg-stone-800"
          >
            Iniciar sesión
          </Link>
        </nav>
      </div>
    </header>
  )
}
