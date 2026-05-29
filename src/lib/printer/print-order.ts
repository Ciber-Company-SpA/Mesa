import type { PrinterConfig, PrinterConnectionType } from "@/types/restaurant"
import { buildOrderTicket, type TicketInput } from "./escpos"

export type PrintResult =
  | { ok: true }
  | { ok: false; error: string }

export async function printOrderTicket(
  ticket: TicketInput,
  connection: PrinterConnectionType,
  config: PrinterConfig
): Promise<PrintResult> {
  const data = buildOrderTicket(ticket)

  switch (connection) {
    case "bluetooth":
      return printViaBluetooth(data, config)
    case "network":
      return printViaNetwork(data, config)
    case "usb":
      return printViaUsb(data, config)
    default:
      return { ok: false, error: "Tipo de conexión desconocido" }
  }
}

async function printViaBluetooth(_data: Uint8Array, _config: PrinterConfig): Promise<PrintResult> {
  // TODO: Web Bluetooth + Capacitor BLE plugin. Por ahora stub.
  return { ok: false, error: "Impresión Bluetooth aún no implementada" }
}

async function printViaNetwork(_data: Uint8Array, _config: PrinterConfig): Promise<PrintResult> {
  // TODO: requiere bridge nativo (Electron net o plugin Capacitor) porque el
  // browser no abre sockets TCP. Stub por ahora.
  return { ok: false, error: "Impresión por red aún no implementada" }
}

async function printViaUsb(_data: Uint8Array, _config: PrinterConfig): Promise<PrintResult> {
  // TODO: Electron IPC o WebUSB. Stub por ahora.
  return { ok: false, error: "Impresión USB aún no implementada" }
}
