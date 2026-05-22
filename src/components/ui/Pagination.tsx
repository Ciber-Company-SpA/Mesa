"use client"

type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function Pagination({ currentPage, totalPages, onPageChange, disabled }: PaginationProps) {
  const pages = getPageRange(currentPage, totalPages)

  return (
    <nav
      aria-label="Paginación"
      className="sticky bottom-4 z-20 mx-auto mt-6 flex w-fit items-center justify-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-2 shadow-xl shadow-stone-900/10 backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-200 disabled:hover:bg-white disabled:hover:text-stone-700"
      >
        Anterior
      </button>

      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-sm text-stone-400"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              disabled={disabled}
              aria-current={page === currentPage ? "page" : undefined}
              className={`min-w-10 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                page === currentPage
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
              }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-200 disabled:hover:bg-white disabled:hover:text-stone-700"
      >
        Siguiente
      </button>
    </nav>
  )
}

function getPageRange(current: number, total: number): (number | "...")[] {
  const delta = 1
  const range: (number | "...")[] = []

  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i)
    } else if (range[range.length - 1] !== "...") {
      range.push("...")
    }
  }

  return range
}