const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const INIT = new Uint8Array([ESC, 0x40])
const ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01])
const ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00])
const DOUBLE_HEIGHT_WIDTH = new Uint8Array([GS, 0x21, 0x11])
const NORMAL_SIZE = new Uint8Array([GS, 0x21, 0x00])
const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01])
const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00])
const CUT = new Uint8Array([GS, 0x56, 0x00])
const NEWLINE = new Uint8Array([LF])

function encodeText(text: string): Uint8Array {
  // CP437 / ASCII fallback: many 58mm printers don't support UTF-8.
  // Strip accents to ASCII so common Spanish words render correctly.
  const normalized = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
  return new TextEncoder().encode(normalized)
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export type TicketItem = {
  name: string
  quantity: number
}

export type TicketInput = {
  restaurantName: string
  tableNumber: number | string
  orderId: number
  items: TicketItem[]
}

export function buildOrderTicket(input: TicketInput): Uint8Array {
  const lines: Uint8Array[] = [INIT]

  lines.push(ALIGN_CENTER, BOLD_ON, DOUBLE_HEIGHT_WIDTH)
  lines.push(encodeText(input.restaurantName), NEWLINE)
  lines.push(NORMAL_SIZE, BOLD_OFF)

  lines.push(encodeText("--------------------------------"), NEWLINE)

  lines.push(BOLD_ON, encodeText(`Mesa ${input.tableNumber}`), NEWLINE, BOLD_OFF)
  lines.push(encodeText(`Pedido #${input.orderId}`), NEWLINE)

  lines.push(encodeText("--------------------------------"), NEWLINE)

  lines.push(ALIGN_LEFT)
  for (const item of input.items) {
    const line = `${item.quantity}x  ${item.name}`
    lines.push(encodeText(line), NEWLINE)
  }

  lines.push(NEWLINE, NEWLINE, NEWLINE, CUT)

  return concat(...lines)
}
