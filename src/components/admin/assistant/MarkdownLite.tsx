import type { ReactNode } from "react"

/**
 * Render minimalista del subset de markdown que usa el asistente (definido en
 * su system prompt): ### subtítulos, **negrita**, *cursiva*, `código`, listas
 * con "- " y numeradas "1. ". Sin dependencias externas ni HTML crudo (todo
 * se construye como nodos React → sin riesgo XSS).
 */

function renderInline(text: string, keyBase: string): ReactNode[] {
  // Tokeniza **negrita**, *cursiva* y `código` (sin anidamiento).
  const parts: ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith("**")) {
      parts.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith("`")) {
      parts.push(
        <code key={`${keyBase}-c${i}`} className="rounded bg-stone-200/70 px-1 py-0.5 text-[12px]">
          {tok.slice(1, -1)}
        </code>
      )
    } else {
      parts.push(<em key={`${keyBase}-i${i}`}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
    i += 1
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let para: string[] = []

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: "p", text: para.join("\n") })
      para = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushPara()
      continue
    }

    const heading = trimmed.match(/^#{1,4}\s+(.*)$/)
    if (heading) {
      flushPara()
      blocks.push({ kind: "h", text: heading[1] })
      continue
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/)
    if (bullet) {
      flushPara()
      const prev = blocks[blocks.length - 1]
      if (prev?.kind === "ul") prev.items.push(bullet[1])
      else blocks.push({ kind: "ul", items: [bullet[1]] })
      continue
    }

    const numbered = trimmed.match(/^\d{1,3}[.)]\s+(.*)$/)
    if (numbered) {
      flushPara()
      const prev = blocks[blocks.length - 1]
      if (prev?.kind === "ol") prev.items.push(numbered[1])
      else blocks.push({ kind: "ol", items: [numbered[1]] })
      continue
    }

    para.push(trimmed)
  }
  flushPara()
  return blocks
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks = parseBlocks(text)

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          return (
            <p key={i} className="pt-0.5 text-[13px] font-bold text-stone-900">
              {renderInline(b.text, `h${i}`)}
            </p>
          )
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="space-y-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-stone-400" />
                  <span className="min-w-0">{renderInline(it, `u${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} className="space-y-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="shrink-0 text-[12px] font-bold text-stone-500">{j + 1}.</span>
                  <span className="min-w-0">{renderInline(it, `o${i}-${j}`)}</span>
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(b.text, `p${i}`)}
          </p>
        )
      })}
    </div>
  )
}
