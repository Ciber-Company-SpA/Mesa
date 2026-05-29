/**
 * Web Bluetooth para impresoras térmicas ESC/POS.
 *
 * La mayoría de impresoras 58mm/80mm chinas (POS-58, MTP-II, RPP02N, GOOJPRT)
 * exponen un servicio Nordic UART-like sobre el UUID 0x18f0 con una
 * característica writable (0x2af1). Algunas usan FFE0/FFE1. Hacemos
 * descubrimiento adaptativo: pedimos ambos servicios y elegimos el primero
 * con una característica writable que aparezca.
 */

const PRIMARY_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb"
const FALLBACK_SERVICE = "0000ff00-0000-1000-8000-00805f9b34fb"

const CHUNK_SIZE = 100 // BLE típico: MTU 23 (20 payload). Chrome negocia más, pero 100 funciona seguro.
const CHUNK_DELAY_MS = 30 // delay entre paquetes para que el buffer del printer no se sature.

export type BluetoothPrinter = {
  device: BluetoothDevice
  characteristic: BluetoothRemoteGATTCharacteristic
}

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth)
}

export async function requestPrinter(preferredName?: string | null): Promise<BluetoothPrinter> {
  if (!isWebBluetoothAvailable()) {
    throw new Error("Tu navegador no soporta Web Bluetooth. Usá Chrome o Edge en escritorio o Android.")
  }

  const filters = preferredName?.trim()
    ? [{ namePrefix: preferredName.trim() }]
    : undefined

  const device = await navigator.bluetooth.requestDevice({
    filters,
    acceptAllDevices: !filters,
    optionalServices: [PRIMARY_SERVICE, FALLBACK_SERVICE],
  })

  return connectToDevice(device)
}

async function connectToDevice(device: BluetoothDevice): Promise<BluetoothPrinter> {
  if (!device.gatt) throw new Error("El dispositivo no expone GATT.")

  const server = await device.gatt.connect()

  for (const service of [PRIMARY_SERVICE, FALLBACK_SERVICE]) {
    try {
      const gattService = await server.getPrimaryService(service)
      const chars = await gattService.getCharacteristics()
      const writable = chars.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse
      )
      if (writable) return { device, characteristic: writable }
    } catch {
      // probamos el siguiente service
    }
  }

  throw new Error("No se encontró una característica writable. ¿Es una impresora compatible?")
}

export async function sendToPrinter(printer: BluetoothPrinter, data: Uint8Array): Promise<void> {
  const char = printer.characteristic
  const useWithoutResponse = char.properties.writeWithoutResponse
  const write = useWithoutResponse
    ? char.writeValueWithoutResponse.bind(char)
    : char.writeValue.bind(char)

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE)
    await write(chunk)
    if (useWithoutResponse) await wait(CHUNK_DELAY_MS)
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
