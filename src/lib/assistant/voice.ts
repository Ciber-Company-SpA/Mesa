/**
 * Voz de MANUEL: text-to-speech con la Web Speech API del navegador (sin
 * servicios externos ni costo). Elige la mejor voz en español disponible,
 * limpia el markdown/emojis antes de leer y trocea el texto en oraciones
 * cortas (evita el bug de Chrome que corta utterances largas).
 */

let cachedVoice: SpeechSynthesisVoice | null = null
let cachedVoiceIsMale = false

// La Web Speech API no expone el género: se detecta por el NOMBRE de la voz.
// Masculinas conocidas por plataforma: Lorenzo (es-CL en Edge Natural), Jorge,
// Álvaro, Pablo, Raúl (Windows), Diego, Juan, Carlos (macOS/iOS), etc.
const MALE_NAME =
  /\b(lorenzo|jorge|alvaro|álvaro|pablo|raul|raúl|diego|juan|carlos|gonzalo|enrique|andres|andrés|tomas|tomás|dario|darío|manuel|felipe|mario|male)\b/i
const FEMALE_NAME =
  /\b(female|monica|mónica|paulina|helena|sabina|laura|catalina|elvira|francisca|camila|lucia|lucía|isabela|marisol|soledad|angelica|angélica|esperanza|ximena|dalia|larissa|andrea|carmen|penelope|penélope|lupe|renata|paloma|salome|salomé|yolanda|vera|triana)\b/i

// Preferencia por cercanía al español de Chile.
const DIALECT_PREFS = ["es-cl", "es-419", "es-us", "es-mx", "es-ar", "es-es", "es"]

function scoreVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase().replace("_", "-")
  if (!lang.startsWith("es")) return -1
  let s = 0
  // Manuel es hombre: una voz masculina pesa más que cualquier otro criterio.
  if (MALE_NAME.test(v.name)) s += 1000
  else if (FEMALE_NAME.test(v.name)) s -= 200
  const rank = DIALECT_PREFS.findIndex((p) => lang.startsWith(p))
  if (rank !== -1) s += (DIALECT_PREFS.length - rank) * 10
  // Las voces "Google/Natural/Neural/Online" suenan mejor que las del sistema.
  if (/google|natural|neural|online/i.test(v.name)) s += 50
  return s
}

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null

  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  let best: SpeechSynthesisVoice | null = null
  let bestScore = -1
  for (const v of voices) {
    const s = scoreVoice(v)
    if (s > bestScore) {
      bestScore = s
      best = v
    }
  }
  cachedVoice = best
  cachedVoiceIsMale = best ? MALE_NAME.test(best.name) : false
  return best
}

// Las voces cargan async en Chrome: refrescar el caché cuando estén listas.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = null
    pickSpanishVoice()
  })
}

/** Quita markdown, emojis y viñetas: lo que se lee debe sonar natural. */
function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/️/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Trocea por oraciones en bloques cortos (~máx 200 chars). */
function chunkSentences(text: string, max = 200): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/)
  const chunks: string[] = []
  let current = ""
  for (const s of sentences) {
    if ((current + " " + s).trim().length > max && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current = (current + " " + s).trim()
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

export function stopSpeaking() {
  if (!speechAvailable()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // navegadores viejos: ignorar
  }
}

/**
 * Lee un texto en voz alta. Devuelve false si el navegador no soporta TTS o
 * no quedó nada que leer tras la limpieza. onStart/onEnd permiten animar la
 * boca de Manuel mientras habla.
 */
export function speakText(
  text: string,
  cb?: { onStart?: () => void; onEnd?: () => void }
): boolean {
  if (!speechAvailable()) return false
  stopSpeaking()

  const clean = stripForSpeech(text)
  if (!clean) return false

  const chunks = chunkSentences(clean)
  const voice = pickSpanishVoice()
  let started = false
  let ended = false
  const endOnce = () => {
    if (!ended) {
      ended = true
      cb?.onEnd?.()
    }
  }

  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? "es-CL"
    u.rate = 1.05
    // Manuel es hombre: con voz masculina real, tono natural; si el navegador
    // solo trae voces femeninas/neutras, se baja el pitch para masculinizarla.
    u.pitch = cachedVoiceIsMale ? 1.0 : 0.75
    u.onstart = () => {
      if (!started) {
        started = true
        cb?.onStart?.()
      }
    }
    if (i === chunks.length - 1) {
      u.onend = endOnce
    }
    // Un cancel() dispara error en las pendientes: cerrar la animación.
    u.onerror = endOnce
    window.speechSynthesis.speak(u)
  })

  return true
}
