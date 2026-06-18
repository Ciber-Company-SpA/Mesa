"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

/* ===================================================================== *
 * Landing pública (marketing) — diseño "Mesa" (Fraunces + coral/pino).
 * Migrado a Tailwind. Las fuentes (Fraunces, Inter, JetBrains Mono) se
 * cargan en layout.tsx como variables CSS. Las animaciones (marquee, scan
 * del QR, float, reveal-on-scroll) viven en globals.css con prefijo mesa-.
 * ===================================================================== */

const SANS = "font-[family-name:var(--font-inter)]"
const DISP = "font-[family-name:var(--font-fraunces)]"
const MONO = "font-[family-name:var(--font-jetbrains)]"

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="729.7 243.3 441.3 374.5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#F87604" d="M1097.8,471.4h-302.04c.86-67.86,74.69-125.23,142.8-129.56v-9.41c-6.41-3.07-10.84-9.68-10.84-17.3,0-10.59,8.53-19.18,19.07-19.18s19.08,8.59,19.08,19.18c0,7.62-4.43,14.21-10.84,17.3v9.39c68.7,4.28,142.78,61.09,142.78,129.57Z" />
      <path fill="#fff" d="M850.5,463.29s5.31-62.47,63.74-95.57c0,0-76.49,6.41-84.98,95.57h21.25Z" />
      <path fill="currentColor" d="M1159.34,486.79c-1.05,18.68-16.57,33.62-35.42,33.62h-136.98c-15.37,0-18.76,39.39-19.48,53.06-.08,1.51.73,2.93,2.08,3.61l50.73,25.93h-139.16l50.53-25.84c1.34-.69,2.15-2.1,2.08-3.61-.7-13.58-4.08-53.15-19.48-53.15h-138.44c-18.85,0-34.37-14.95-35.42-33.62h418.96Z" />
      <line stroke="#fff" strokeMiterlimit="10" strokeWidth="1.56" x1="1159.34" y1="486.79" x2="740.37" y2="486.79" />
      <polygon fill="currentColor" points="837.83 247.27 837.83 309.3 815.12 309.3 815.12 272.46 756.57 272.46 756.57 337.42 793.45 337.42 793.45 362.59 733.85 362.59 733.85 247.27 837.83 247.27" />
      <polygon fill="currentColor" points="1063.1 247.27 1063.1 309.3 1085.8 309.3 1085.8 272.46 1144.36 272.46 1144.36 337.42 1107.47 337.42 1107.47 362.59 1167.07 362.59 1167.07 247.27 1063.1 247.27" />
      <polygon fill="currentColor" points="1166.88 539.91 1166.88 613.76 1062.9 613.76 1062.9 551.73 1085.6 551.73 1085.6 588.57 1144.16 588.57 1144.16 539.91 1166.88 539.91" />
      <polygon fill="currentColor" points="733.73 539.91 733.73 613.76 837.7 613.76 837.7 551.73 815 551.73 815 588.57 756.45 588.57 756.45 539.91 733.73 539.91" />
      <rect fill="currentColor" x="870.02" y="247.27" width="25.4" height="25.53" />
      <rect fill="currentColor" x="733.85" y="389.98" width="25.4" height="25.53" />
      <rect fill="currentColor" x="1141.48" y="389.98" width="25.4" height="25.53" />
      <rect fill="currentColor" x="1006.66" y="247.27" width="25.4" height="25.53" />
    </svg>
  )
}

function LogoWord({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="528.1 665.9 863.8 170.9" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="currentColor" d="M706.88,747.95l-58.53,80.3h-17.23l-49.78-79.18-8.75,81.64h-40.48l13.67-156.8,33.64-.22,64,100.21,72.2-100.21,27.07.22,13.95,156.8h-40.2l-9.57-82.76Z" />
      <path fill="currentColor" d="M814.1,673.91h134.28v32.21h-91.62c0,10.29-.27,20.58-.27,31.09h77.67v31.32h-77.4v29.75h94.63v32.43h-137.56l.27-156.8Z" />
      <path fill="currentColor" d="M1078.83,832.73c-27.35,0-44.85-6.26-73.02-22.37l13.13-30.42c26.8,12.97,43.76,19.68,57.16,19.68,18.87,0,41.29-5.59,41.29-18.12,0-13.65-28.44-15.21-40.48-16.33-31.18-3.13-71.93-8.95-71.93-45.63,0-41.38,47.59-49.66,75.21-49.66,25.44,0,48.41,6.71,73.29,21.25l-12.58,28.41c-21.33-11.41-41.84-16.77-60.72-16.77-29.26,0-36.1,9.62-36.1,15.43,0,11.18,31.45,13.65,39.93,13.65,28.72,2.46,73.02,6.93,73.02,49.66s-48.41,51.22-78.22,51.22Z" />
      <path fill="currentColor" d="M1331.82,801.41h-76.03l-14.49,29.3h-41.84l79.58-157.25h32.82l76.03,157.25h-42.94l-13.13-29.3ZM1270.28,769.65h47.04l-23.25-49.21-23.79,49.21Z" />
    </svg>
  )
}

const Check = () => (
  <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
)
const Arrow = () => (
  <svg className="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

const marqueeItems = [
  "Sin filas en caja", "Cero errores de comanda", "Menú siempre al día",
  "Cocina en tiempo real", "Funciona sin internet", "Carga tu carta con IA",
  "Reportes por producto",
]

const flowSteps = [
  {
    title: "Escanea la mesa",
    text: "Cada mesa tiene su QR. Sin descargar nada, el menú abre en el navegador.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v.01M21 17v.01M17 21v.01" /></svg>,
  },
  {
    title: "Arma el pedido",
    text: "El cliente elige por categoría, ve fotos y precios, y agrega notas.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></svg>,
  },
  {
    title: "La cocina recibe",
    text: "La comanda entra a pantalla con número de mesa, hora y detalle.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  },
  {
    title: "Tú administras",
    text: "Ves ventas por producto, mesa y horario para decidir con datos.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>,
  },
]

const icoTone: Record<string, string> = {
  coral: "bg-[#F87604]/12 text-[#D95F00]",
  amber: "bg-[#FFA62B]/16 text-[#C77B00]",
  pine: "bg-[#1C4D43]/10 text-[#1C4D43]",
}

const plans = [
  {
    name: "Plan 15", range: "1 – 15 mesas", featured: false,
    was: "$2.500.000 + IVA", now: "$1.250.000 + IVA",
    addon: "+ $150.000", addonText: "Soporte Tier 3 · 24/7 (recomendado)",
    feats: ["Menú QR + carga con IA", "Vistas Cliente, Cocina, Mesero y Admin", "Reportes básicos"],
    mesas: "1 – 15 mesas", btn: "ghost",
  },
  {
    name: "Plan 50", range: "16 – 50 mesas", featured: true,
    was: "$6.000.000 + IVA", now: "$3.000.000 + IVA",
    addon: "+ $300.000", addonText: "Soporte Tier 3 · 24/7 (recomendado)",
    feats: ["Todo lo del Plan 15", "Reportes avanzados y horas peak", "Gestión completa de meseros"],
    mesas: "16 – 50 mesas", btn: "primary",
  },
  {
    name: "Plan 100", range: "50 – 100 mesas", featured: false,
    was: "$10.000.000 + IVA", now: "$5.000.000 + IVA",
    addon: "+ $450.000", addonText: "Soporte Tier 3 · 24/7 (recomendado)",
    feats: ["Todo lo del Plan 50", "Operación de alto volumen", "Prioridad en soporte"],
    mesas: "50 – 100 mesas", btn: "ghost",
  },
  {
    name: "Personalizado", range: "100+ mesas o varias sucursales", featured: false, custom: true,
    nowText: "Contactar",
    addon: "Soporte a medida", addonText: "Definimos el nivel según tu caso",
    feats: ["Multi-sucursal", "Reportes consolidados", "Integraciones a medida"],
    mesas: "100+ o varias sucursales", btn: "dark",
  },
] as const

const faqs = [
  { q: "¿Mis clientes tienen que descargar una app?", a: "No. MESA es una web app: tus clientes escanean el QR con la cámara y el menú abre directo en el navegador. No instalan nada." },
  { q: "¿Cómo genero el QR de cada mesa?", a: "Desde el panel, en la sección Mesas. Cada mesa tiene su QR único, que puedes descargar en PDF para imprimir y pegar en la mesa." },
  { q: "¿Puedo usarlo si solo quiero el menú digital?", a: "Sí. Puedes publicar solo el menú QR para que tus clientes lo vean, y activar la toma de pedidos a cocina más adelante cuando quieras." },
  { q: "¿La cocina necesita un equipo especial?", a: "No. Basta una pantalla o tablet con navegador para ver las comandas en tiempo real, o una impresora térmica bluetooth para la boleta. Si la máquina falla, los meseros gestionan todo desde el panel." },
  { q: "¿Cómo se cobran los pagos en línea?", a: "Hoy el cobro se hace en el local: el cliente pide la cuenta desde la app y el mesero la cierra. La integración de pago en línea está en el roadmap." },
  { q: "¿Cómo funciona el precio y el soporte?", a: "El precio depende de la cantidad de mesas (planes 15, 50, 100 o personalizado) e incluye acceso completo a la plataforma. El soporte Tier 3 24/7 es un complemento recomendado." },
]

// Documentos legales. NOTA: textos en lenguaje claro a modo de borrador;
// revísalos con tu asesoría legal antes de publicar en producción.
const legalDocs = [
  {
    title: "Términos y condiciones",
    body: [
      ["Qué es MESA", "MESA es una plataforma de menú digital y toma de pedidos por QR para restaurantes y cafeterías. Al contratar el servicio, el local (el “Cliente”) obtiene acceso a un panel de administración y a las vistas de cliente, cocina y mesero."],
      ["Uso del servicio", "El Cliente es responsable del contenido que carga (menú, precios, imágenes) y de mantener sus credenciales seguras. No está permitido usar la plataforma para fines ilícitos ni intentar vulnerar la seguridad del sistema o de otros locales."],
      ["Precios y pagos", "El valor depende del plan contratado según la cantidad de mesas. Los precios se expresan en pesos chilenos (CLP) más IVA. El soporte Tier 3 24/7 es un complemento opcional con costo aparte."],
      ["Disponibilidad y responsabilidad", "Trabajamos para mantener el servicio disponible de forma continua, pero no garantizamos una operación libre de interrupciones. MESA no es responsable de pérdidas indirectas derivadas de cortes de conexión del local o de terceros."],
    ],
  },
  {
    title: "Política de privacidad",
    body: [
      ["Qué datos tratamos", "Datos de la cuenta del local y su personal (nombre, correo), el contenido del menú y datos operativos de los pedidos. Los clientes finales del local pueden navegar el menú y pedir sin crear una cuenta."],
      ["Para qué los usamos", "Para operar el servicio: mostrar el menú, procesar pedidos en tiempo real, generar reportes para el local y enviar notificaciones operativas (por ejemplo, credenciales a meseros)."],
      ["Con quién los compartimos", "Usamos proveedores de infraestructura para prestar el servicio (base de datos y autenticación, almacenamiento de imágenes y envío de correos). No vendemos datos personales a terceros."],
      ["Tus derechos", "El Cliente puede solicitar acceder, corregir o eliminar sus datos escribiéndonos al correo de contacto. Conservamos los datos mientras la cuenta esté activa y por los plazos que exija la ley."],
    ],
  },
]

function btnClass(kind: string) {
  const base = `${SANS} inline-flex items-center justify-center gap-2 font-semibold text-[15.5px] px-6 py-3 rounded-full border-[1.5px] border-transparent cursor-pointer transition-all duration-300 whitespace-nowrap`
  if (kind === "primary") return `${base} bg-[#F87604] text-white shadow-[0_8px_22px_rgba(248,118,4,.32)] hover:bg-[#D95F00] hover:-translate-y-0.5`
  if (kind === "ghost") return `${base} bg-transparent text-[#221C18] border-[#221C18]/25 hover:border-[#221C18] hover:bg-[#FAF6F0] hover:-translate-y-0.5`
  if (kind === "dark") return `${base} bg-[#221C18] text-white hover:bg-black hover:-translate-y-0.5`
  return base
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [legalOpen, setLegalOpen] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSent, setModalSent] = useState(false)
  const [modalMesas, setModalMesas] = useState("1 – 15 mesas")

  const openModal = (mesas?: string) => {
    setModalSent(false)
    if (mesas) setModalMesas(mesas)
    setModalOpen(true)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModalOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll(".mesa-reveal")
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target) }
      }),
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className={`${SANS} min-w-0 flex-1 bg-white text-[#221C18] text-[17px] leading-[1.6] antialiased`}>
      {/* ---------- NAV ---------- */}
      <header className={`fixed inset-x-0 top-0 z-[100] transition-all duration-300 ${scrolled ? "bg-white/85 backdrop-blur-xl shadow-[0_1px_0_#ECE3D8] py-[11px]" : "py-[18px]"}`}>
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-7">
          <a href="#top" className="inline-flex items-center gap-[11px] text-[#221C18] transition-opacity hover:opacity-80" aria-label="Mesa, ir al inicio">
            <LogoMark className="h-[30px] w-auto shrink-0" />
            <LogoWord className="h-[18px] w-auto shrink-0" />
          </a>
          <nav className={`items-center gap-[34px] md:flex ${navOpen ? "fixed inset-x-3.5 top-16 flex flex-col items-start gap-1.5 rounded-[18px] border border-[#ECE3D8] bg-white p-3.5 shadow-[0_30px_70px_rgba(34,28,24,.16)]" : "hidden"}`}>
            {[["Funcionalidades", "#funcionalidades"], ["Cómo funciona", "#como"], ["Planes", "#planes"], ["Ayuda", "#ayuda"]].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setNavOpen(false)} className="text-[15px] font-medium text-[#6B615A] transition-colors hover:text-[#221C18] max-md:w-full max-md:py-2">{label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3.5">
            <Link href="/login" className={`${btnClass("ghost")} max-md:hidden`}>Iniciar sesión</Link>
            <button className={btnClass("primary")} onClick={() => openModal()}>Contactar</button>
            <button className="grid place-items-center rounded-[10px] border-[1.5px] border-[#ECE3D8] p-[9px] md:hidden" aria-label="Abrir menú" onClick={() => setNavOpen((v) => !v)}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <header id="top" className="relative overflow-hidden px-0 pt-[140px] pb-[90px] max-md:pt-[120px] max-md:pb-[70px]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-[120px] -right-20 h-[520px] w-[520px] rounded-full blur-[10px]" style={{ background: "radial-gradient(circle at 30% 30%, rgba(255,166,43,.28), transparent 62%)" }} />
          <div className="absolute -bottom-[160px] -left-[120px] h-[460px] w-[460px] rounded-full blur-[10px]" style={{ background: "radial-gradient(circle at 60% 40%, rgba(248,118,4,.16), transparent 65%)" }} />
        </div>
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-7 md:grid-cols-[1.05fr_.95fr]">
          <div>
            <span className={`${MONO} mesa-reveal inline-flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.22em] text-[#D95F00] before:inline-block before:h-[1.5px] before:w-[26px] before:bg-[#F87604] before:content-['']`}>Menú digital + comandas en tiempo real</span>
            <h1 className={`${DISP} mesa-reveal mt-[22px] text-[clamp(2.6rem,5.6vw,4.5rem)] font-semibold leading-[1.04] tracking-[-.01em]`}>
              El menú que <em className="font-medium italic text-[#F87604]">toma el pedido</em> por ti.
            </h1>
            <p className="mesa-reveal mt-[22px] max-w-[30ch] text-[clamp(1.05rem,1.6vw,1.3rem)] leading-[1.55] text-[#6B615A]">
              Tu cliente escanea la mesa, pide desde su teléfono y la cocina lo recibe al instante. Tú administras categorías, productos y mesas desde un solo panel.
            </p>
            <div className="mesa-reveal mt-8 flex flex-wrap gap-3.5">
              <a href="#planes" className={btnClass("primary")}>Ver planes <Arrow /></a>
              <a href="#como" className={btnClass("ghost")}>Ver cómo funciona</a>
            </div>
            <div className="mesa-reveal mt-9 flex flex-wrap items-center gap-[18px]">
              <div className="flex">
                {[["#1C4D43", "P"], ["#F87604", "M"], ["#2E6B5E", "A"], ["#D95F00", "+"]].map(([bg, ch], i) => (
                  <span key={ch} className="grid h-9 w-9 place-items-center rounded-full border-[2.5px] border-white text-[14px] font-semibold text-white" style={{ background: bg, marginLeft: i === 0 ? 0 : -10 }}>{ch}</span>
                ))}
              </div>
              <small className="text-[13.5px] leading-[1.4] text-[#6B615A]">Restaurantes y cafeterías ya<br /><b className="font-semibold text-[#221C18]">operan sin caos con MESA</b></small>
            </div>
          </div>

          {/* signature visual: teléfono sobre la mesa + tag QR */}
          <div aria-hidden className="relative mx-auto h-[560px] w-full max-w-[300px] justify-self-center max-md:max-w-[360px]">
            <div className="absolute bottom-[6%] left-1/2 h-[46%] w-[108%] -translate-x-1/2 rounded-[50%] shadow-[inset_0_2px_0_rgba(255,255,255,.7),0_10px_30px_rgba(34,28,24,.10)]" style={{ background: "linear-gradient(160deg,#FAF6F0,#F3ECE2)" }} />
            <div className="absolute left-1/2 top-0 z-[3] h-[520px] w-[260px] -translate-x-1/2 rotate-[-3deg] rounded-[38px] bg-[#0e0c0b] p-[11px] shadow-[0_30px_70px_rgba(34,28,24,.16)]">
              <PhonePreview />
            </div>
            <div className="absolute bottom-[5%] right-[-18px] z-[4] w-[120px] rotate-[4deg] rounded-[16px] border border-[#ECE3D8] bg-white p-[11px] shadow-[0_30px_70px_rgba(34,28,24,.16)]">
              <div className="mb-[9px] flex items-center justify-between">
                <b className={`${MONO} text-[11px] font-bold tracking-[.1em]`}>MESA 07</b>
                <i className="rounded-[6px] bg-[#1C4D43]/10 px-[7px] py-[3px] text-[9px] font-semibold not-italic text-[#1C4D43]">Escanéame</i>
              </div>
              <div className="relative aspect-square w-full overflow-hidden rounded-[11px] border border-[#ECE3D8] bg-white">
                <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Código QR de la mesa">
                  <rect width="100" height="100" fill="#fff" />
                  <g fill="#221C18">
                    <path d="M8 8h26v26H8zM14 14v14h14V14z" /><path d="M66 8h26v26H66zM72 14v14h14V14z" /><path d="M8 66h26v26H8zM14 72v14h14V72z" />
                    <rect x="18" y="18" width="6" height="6" /><rect x="76" y="18" width="6" height="6" /><rect x="18" y="76" width="6" height="6" />
                    <rect x="42" y="8" width="6" height="6" /><rect x="54" y="8" width="6" height="6" /><rect x="42" y="20" width="6" height="6" />
                    <rect x="8" y="42" width="6" height="6" /><rect x="20" y="42" width="6" height="6" /><rect x="8" y="54" width="6" height="6" />
                    <rect x="42" y="42" width="6" height="6" /><rect x="54" y="42" width="6" height="6" /><rect x="66" y="42" width="6" height="6" /><rect x="78" y="42" width="6" height="6" /><rect x="90" y="42" width="6" height="6" />
                    <rect x="42" y="54" width="6" height="6" /><rect x="66" y="54" width="6" height="6" /><rect x="90" y="54" width="6" height="6" />
                    <rect x="42" y="66" width="6" height="6" /><rect x="54" y="66" width="6" height="6" /><rect x="78" y="66" width="6" height="6" />
                    <rect x="42" y="78" width="6" height="6" /><rect x="66" y="78" width="6" height="6" /><rect x="90" y="78" width="6" height="6" />
                    <rect x="54" y="90" width="6" height="6" /><rect x="78" y="90" width="6" height="6" />
                  </g>
                </svg>
                <div className="animate-mesa-scan absolute inset-x-[6%] h-[2px] shadow-[0_0_12px_2px_rgba(248,118,4,.6)]" style={{ background: "linear-gradient(90deg,transparent,#F87604,transparent)" }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- MARQUEE ---------- */}
      {/* Dos grupos idénticos sin gap entre ellos; cada ítem lleva su separador
          con margen uniforme (también después del último), así translateX(-50%)
          cae exactamente en la costura y el loop es continuo, sin saltos. */}
      <div aria-hidden className="overflow-hidden border-y border-[#ECE3D8] bg-white py-5">
        <div className="animate-mesa-marquee flex w-max">
          {[0, 1].map((g) => (
            <div key={g} className="flex shrink-0 items-center">
              {marqueeItems.map((t, i) => (
                <span key={i} className={`${DISP} whitespace-nowrap text-[20px] font-medium text-[#6B615A] after:mx-[30px] after:text-[#F87604] after:content-['·']`}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="como" className="px-0 py-24 max-md:py-[72px]">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="mesa-reveal mx-auto mb-[54px] max-w-[640px] text-center">
            <span className={`${MONO} inline-flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.22em] text-[#D95F00] before:inline-block before:h-[1.5px] before:w-[26px] before:bg-[#F87604] before:content-['']`}>Del QR al plato</span>
            <h2 className={`${DISP} mt-4 text-[clamp(2rem,3.6vw,3rem)] font-semibold`}>Cuatro pasos, cero fricción.</h2>
            <p className="mt-4 text-[1.1rem] text-[#6B615A]">Es una secuencia real: tu cliente pide solo y tu equipo trabaja sobre pedidos que llegan ordenados.</p>
          </div>
          <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
            {flowSteps.map((s, i) => (
              <div key={s.title} className="mesa-reveal relative pt-[30px]">
                <span className={`${MONO} absolute left-0 top-0 text-[13px] font-bold text-[#F87604]`}>0{i + 1}</span>
                <div className="mb-4 grid h-[50px] w-[50px] place-items-center rounded-[14px] bg-[#FAF6F0] text-[#1C4D43] [&_svg]:h-6 [&_svg]:w-6">{s.icon}</div>
                <h3 className={`${DISP} mb-[7px] text-[1.25rem] font-semibold`}>{s.title}</h3>
                <p className="text-[14.5px] text-[#6B615A]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FEATURES (bento) ---------- */}
      <section id="funcionalidades" className="bg-[#FAF6F0] px-0 py-24 max-md:py-[72px]">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="mesa-reveal mb-[54px] max-w-[640px]">
            <span className={`${MONO} inline-flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.22em] text-[#D95F00] before:inline-block before:h-[1.5px] before:w-[26px] before:bg-[#F87604] before:content-['']`}>Todo en un panel</span>
            <h2 className={`${DISP} mt-4 text-[clamp(2rem,3.6vw,3rem)] font-semibold`}>Una herramienta para mandar tu local entero.</h2>
            <p className="mt-4 text-[1.1rem] text-[#6B615A]">Desde el menú que ve el cliente hasta los números que ves tú al cerrar la caja.</p>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-[18px] md:grid-cols-2 lg:grid-cols-12">
            {/* 1 · Card grande coral: función estrella */}
            <article className="mesa-reveal relative flex flex-col overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#F87604,#D95F00)] p-7 text-white md:col-span-2 lg:col-span-8 lg:row-span-2">
              <div className="mb-5 grid h-[54px] w-[54px] place-items-center rounded-[13px] bg-white/20 [&_svg]:h-6 [&_svg]:w-6">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v.01M21 17v.01M17 21v.01" /></svg>
              </div>
              <h3 className={`${DISP} mb-3.5 max-w-[16ch] text-[clamp(1.6rem,2.2vw,2.05rem)] font-semibold leading-[1.08]`}>Pedidos por QR en cada mesa</h3>
              <p className="max-w-[32ch] text-[15.5px] text-white/90">El corazón de Mesa: el cliente escanea, pide y paga desde su mesa. Menos filas, menos errores y mesas que rotan más rápido.</p>
              <span className={`${MONO} mt-auto pt-[18px] text-[11px] uppercase tracking-[.14em] text-white/85`}>Función estrella</span>
              <div className="pointer-events-none absolute -bottom-[30px] -right-[30px] h-[140px] w-[140px] rounded-full bg-white/[.08]" />
            </article>

            {/* 2 · Carga IA (blanca, arriba-derecha) */}
            <article className="mesa-reveal relative flex flex-col overflow-hidden rounded-[28px] border border-[#ECE3D8] bg-white p-[26px] transition-all duration-300 hover:-translate-y-[5px] hover:border-transparent hover:shadow-[0_10px_30px_rgba(34,28,24,.10)] lg:col-span-4">
              <div className="mb-4 grid h-[46px] w-[46px] place-items-center rounded-[13px] bg-[#FFA62B]/16 text-[#C77B00] [&_svg]:h-[23px] [&_svg]:w-[23px]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg></div>
              <h3 className={`${DISP} mb-[9px] text-[1.3rem] font-semibold`}>Carga tu menú con IA</h3>
              <p className="text-[14.5px] text-[#6B615A]">Sube tu carta en PDF y la IA extrae productos, precios y categorías.</p>
            </article>

            {/* 3 · Comandas en vivo (pino, medio-derecha) */}
            <article className="mesa-reveal relative flex flex-col overflow-hidden rounded-[28px] bg-[#1C4D43] p-[26px] text-white lg:col-span-4">
              <div className="mb-4 grid h-[46px] w-[46px] place-items-center rounded-[13px] bg-white/14 text-white [&_svg]:h-[23px] [&_svg]:w-[23px]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg></div>
              <h3 className={`${DISP} mb-[9px] text-[1.3rem] font-semibold`}>Comandas en vivo</h3>
              <p className="text-[14.5px] text-white/80">Pantalla de cocina con cada pedido por mesa y estado.</p>
              <span className={`${MONO} mt-auto pt-[18px] text-[11px] uppercase tracking-[.14em] text-white/65`}>Tiempo real</span>
            </article>

            {/* 4-7 · Fila inferior (blancas) */}
            {[
              { t: "Categorías", d: "Organiza la carta en secciones y ordénalas a tu gusto.", tone: "coral", ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg> },
              { t: "Productos", d: "Fotos, precios, variantes y stock. Agotado se oculta solo.", tone: "amber", ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg> },
              { t: "Mesas y salones", d: "Crea mesas por salón y genera el QR único de cada una con un clic.", tone: "pine", ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v.01M21 17v.01M17 21v.01" /></svg> },
              { t: "Reportes", d: "Ventas por producto, mesa y hora: tu plato estrella y tus horas valle.", tone: "coral", ico: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg> },
            ].map((c) => (
              <article key={c.t} className="mesa-reveal relative flex flex-col overflow-hidden rounded-[28px] border border-[#ECE3D8] bg-white p-[26px] transition-all duration-300 hover:-translate-y-[5px] hover:border-transparent hover:shadow-[0_10px_30px_rgba(34,28,24,.10)] lg:col-span-3">
                <div className={`mb-4 grid h-[46px] w-[46px] place-items-center rounded-[13px] ${icoTone[c.tone]} [&_svg]:h-[23px] [&_svg]:w-[23px]`}>{c.ico}</div>
                <h3 className={`${DISP} mb-[9px] text-[1.3rem] font-semibold`}>{c.t}</h3>
                <p className="text-[14.5px] text-[#6B615A]">{c.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PLANES ---------- */}
      <section id="planes" className="border-y border-[#ECE3D8] bg-white px-0 py-24 max-md:py-[72px]">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="mesa-reveal mx-auto mb-[54px] max-w-[640px] text-center">
            <span className={`${MONO} inline-flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.22em] text-[#D95F00] before:inline-block before:h-[1.5px] before:w-[26px] before:bg-[#F87604] before:content-['']`}>Planes</span>
            <h2 className={`${DISP} mt-4 text-[clamp(2rem,3.6vw,3rem)] font-semibold`}>Un plan para cada tamaño de local.</h2>
            <p className="mt-4 text-[1.1rem] text-[#6B615A]">El precio depende de la cantidad de mesas. Incluye acceso completo a la plataforma; el soporte Tier 3 24/7 es un complemento recomendado.</p>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.name} className={`mesa-reveal relative flex flex-col rounded-[28px] bg-white p-7 px-[22px] transition-all duration-300 hover:-translate-y-[5px] hover:shadow-[0_10px_30px_rgba(34,28,24,.10)] ${p.featured ? "border-[1.5px] border-[#F87604] shadow-[0_24px_50px_rgba(248,118,4,.15)]" : "border border-[#ECE3D8]"}`}>
                {p.featured && <span className={`${MONO} absolute -top-[13px] left-1/2 -translate-x-1/2 rounded-full bg-[#F87604] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-white`}>Más elegido</span>}
                <div className={`${DISP} text-[1.5rem] font-semibold`}>{p.name}</div>
                <div className="mt-[5px] mb-4 text-[14px] text-[#6B615A]">{p.range}</div>
                {"now" in p && p.now ? (
                  <>
                    <span className="mb-2.5 self-start rounded-full bg-[#F87604]/10 px-3 py-[7px] text-[12.5px] font-semibold text-[#D95F00]">★ 50% OFF lanzamiento</span>
                    <span className="text-[14px] text-[#6B615A] line-through decoration-[#6B615A]/60">{p.was}</span>
                    <div className={`${DISP} mt-1 flex items-baseline gap-x-[7px] gap-y-[2px] leading-[1.05]`}>
                      <span className="text-[clamp(1.7rem,2.3vw,2.15rem)] font-semibold tracking-[-.02em] text-[#D95F00]">{p.now}</span>
                    </div>
                    <span className="mt-2.5 text-[13.5px] text-[#6B615A]">Acceso a la plataforma</span>
                  </>
                ) : (
                  <div className={`${DISP} mt-1 text-[clamp(1.5rem,2vw,1.9rem)] font-semibold`}>{("nowText" in p && p.nowText) || "Contactar"}<small className={`${SANS} mt-[3px] block text-[12px] font-semibold text-[#6B615A]`}>A medida de tu operación</small></div>
                )}
                <div className={`mt-[18px] rounded-[18px] border border-[#ECE3D8] p-[13px] px-[15px] ${p.featured || ("custom" in p && p.custom) ? "bg-white" : "bg-[#FAF6F0]"}`}>
                  <b className={`${DISP} block text-[15px] font-semibold`}>{p.addon}</b>
                  <small className="mt-0.5 block text-[12px] leading-[1.4] text-[#6B615A]">{p.addonText}</small>
                </div>
                <ul className="my-6 flex flex-1 flex-col gap-3">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14.5px] text-[#3a3733]"><span className="mt-[3px] text-[#F87604]"><Check /></span>{f}</li>
                  ))}
                </ul>
                <button className={`${btnClass(p.btn)} w-full`} onClick={() => openModal(p.mesas)}>Contactar</button>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-[38px] max-w-[780px] text-center text-[14px] leading-[1.6] text-[#6B615A]">
            Los valores son referenciales en pesos chilenos (CLP). El costo de procesamiento de menú con IA se absorbe en el setup.{" "}
            <button onClick={() => openModal()} className="font-semibold text-[#D95F00] hover:underline">Habla con un ejecutivo</button> para una propuesta a tu medida.
          </p>
        </div>
      </section>

      {/* ---------- AYUDA / FAQ ---------- */}
      <section id="ayuda" className="px-0 py-24 max-md:py-[72px]">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <div className="mesa-reveal lg:sticky lg:top-[110px]">
              <span className={`${MONO} inline-flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.22em] text-[#D95F00] before:inline-block before:h-[1.5px] before:w-[26px] before:bg-[#F87604] before:content-['']`}>Ayuda</span>
              <h2 className={`${DISP} my-4 text-[clamp(1.8rem,3vw,2.6rem)] font-semibold`}>¿Tienes una duda? Aquí partimos.</h2>
              <p className="mb-[26px] text-[#6B615A]">Las preguntas que más nos hacen, y dónde encontrarnos cuando necesitas a una persona.</p>
              <div className="flex flex-col gap-3.5">
                <button onClick={() => openModal()} className="flex items-center gap-3.5 rounded-[18px] border border-[#ECE3D8] bg-white p-4 px-[18px] text-left transition-all hover:translate-x-1 hover:border-[#F87604]">
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-[#FAF6F0] text-[#1C4D43]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></span>
                  <span><b className="block text-[15px]">Chat de soporte</b><small className="text-[13px] text-[#6B615A]">Respondemos de 9 a 21 h, todos los días.</small></span>
                </button>
                <a href="mailto:hola@mesa.app" className="flex items-center gap-3.5 rounded-[18px] border border-[#ECE3D8] bg-white p-4 px-[18px] text-left transition-all hover:translate-x-1 hover:border-[#F87604]">
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-[#FAF6F0] text-[#1C4D43]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="m22 7-10 6L2 7" /></svg></span>
                  <span><b className="block text-[15px]">hola@mesa.app</b><small className="text-[13px] text-[#6B615A]">Escríbenos y te contestamos el mismo día.</small></span>
                </a>
                <button onClick={() => openModal()} className="flex items-center gap-3.5 rounded-[18px] border border-[#ECE3D8] bg-white p-4 px-[18px] text-left transition-all hover:translate-x-1 hover:border-[#F87604]">
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-[#FAF6F0] text-[#1C4D43]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg></span>
                  <span><b className="block text-[15px]">Centro de ayuda</b><small className="text-[13px] text-[#6B615A]">Guías paso a paso para configurar tu local.</small></span>
                </button>
              </div>
            </div>

            <div className="mesa-reveal flex flex-col">
              {faqs.map((f, i) => {
                const open = faqOpen === i
                return (
                  <div key={f.q} className={`border-b border-[#ECE3D8] ${open ? "is-open" : ""}`}>
                    <button onClick={() => setFaqOpen(open ? null : i)} className={`${DISP} flex w-full items-center justify-between gap-[18px] py-[22px] px-1 text-left text-[1.18rem] font-semibold text-[#221C18]`}>
                      {f.q}
                      <span className={`relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-300 ${open ? "border-[#F87604] bg-[#F87604]" : "border-[#ECE3D8]"}`}>
                        <span className={`absolute h-[1.5px] w-[11px] ${open ? "bg-white" : "bg-[#F87604]"}`} />
                        <span className={`absolute h-[11px] w-[1.5px] transition-transform ${open ? "scale-y-0 bg-white" : "bg-[#F87604]"}`} />
                      </span>
                    </button>
                    <div className="overflow-hidden transition-[max-height] duration-300" style={{ maxHeight: open ? 500 : 0 }}>
                      <p className="max-w-[60ch] px-1 pb-6 text-[15.5px] text-[#6B615A]">{f.a}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- LEGAL ---------- */}
      <section id="legal" className="bg-[#FAF6F0] px-0 py-24 max-md:py-[72px]">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="mesa-reveal mx-auto mb-[54px] max-w-[640px] text-center">
            <span className={`${MONO} inline-flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.22em] text-[#D95F00] before:inline-block before:h-[1.5px] before:w-[26px] before:bg-[#F87604] before:content-['']`}>Lo legal, en claro</span>
            <h2 className={`${DISP} mt-4 text-[clamp(2rem,3.6vw,3rem)] font-semibold`}>Términos y privacidad sin letra chica.</h2>
            <p className="mt-4 text-[1.1rem] text-[#6B615A]">Toca cada panel para leer el detalle. Escrito para que se entienda, no para esconder nada.</p>
          </div>
          <div className="grid grid-cols-1 gap-[22px] md:grid-cols-2">
            {legalDocs.map((doc, i) => {
              const open = legalOpen === i
              return (
                <div key={doc.title} className="mesa-reveal h-fit overflow-hidden rounded-[28px] border border-[#ECE3D8] bg-white">
                  <button onClick={() => setLegalOpen(open ? null : i)} className="flex w-full items-center justify-between gap-4 p-7 text-left">
                    <span>
                      <small className={`${MONO} block text-[11px] uppercase tracking-[.1em] text-[#6B615A]`}>Documento</small>
                      <h3 className={`${DISP} mt-1 text-[1.35rem] font-semibold`}>{doc.title}</h3>
                    </span>
                    <svg className={`h-5 w-5 shrink-0 text-[#F87604] transition-transform duration-300 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  <div className="overflow-hidden transition-[max-height] duration-500" style={{ maxHeight: open ? 900 : 0 }}>
                    <div className="px-7 pb-7 text-[14.5px] text-[#6B615A]">
                      {doc.body.map(([h, p]) => (
                        <div key={h}>
                          <h4 className="mt-[18px] text-[14px] font-bold text-[#221C18]">{h}</h4>
                          <p className="mt-1.5 max-w-[64ch] leading-relaxed">{p}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="px-0 pb-24 max-md:pb-[72px]">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="mesa-reveal relative overflow-hidden rounded-[28px] bg-[#221C18] px-12 py-16 text-center text-white max-md:px-[26px] max-md:py-12">
            <div className="pointer-events-none absolute -top-20 -right-10 h-[300px] w-[300px] rounded-full" style={{ background: "radial-gradient(circle,rgba(248,118,4,.4),transparent 65%)" }} />
            <div className="pointer-events-none absolute -bottom-[100px] -left-[60px] h-[320px] w-[320px] rounded-full" style={{ background: "radial-gradient(circle,rgba(255,166,43,.28),transparent 65%)" }} />
            <div className="relative z-[1]">
              <h2 className={`${DISP} mx-auto max-w-[18ch] text-[clamp(2rem,4vw,3.2rem)] font-semibold`}>Tu próxima mesa puede <em className="font-medium italic text-[#FFA62B]">pedir sola</em>.</h2>
              <p className="mx-auto mt-[18px] mb-8 max-w-[46ch] text-white/70">Configuramos tu carta, generamos los QR de cada mesa y te dejamos recibiendo comandas.</p>
              <div className="flex flex-wrap justify-center gap-3.5">
                <a href="#planes" className={`${SANS} inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-transparent bg-white px-6 py-3 text-[15.5px] font-semibold text-[#221C18] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#FFA62B]`}>Ver planes</a>
                <button onClick={() => openModal()} className={`${SANS} inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-white/30 bg-transparent px-6 py-3 text-[15.5px] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white`}>Habla con un ejecutivo</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="px-0 pt-18 pb-9">
        <div className="mx-auto max-w-[1180px] px-7">
          <div className="grid grid-cols-1 gap-10 border-b border-[#ECE3D8] pb-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <a href="#top" className="inline-flex items-center gap-[11px] text-[#221C18]" aria-label="Mesa inicio">
                <LogoMark className="h-[34px] w-auto" />
                <LogoWord className="h-[21px] w-auto" />
              </a>
              <p className="mt-4 max-w-[32ch] text-[14.5px] text-[#6B615A]">Sistema de pedidos por QR para restaurantes y cafeterías. Más mesas atendidas, menos errores — sin contratar más personal.</p>
            </div>
            {[
              ["Producto", [["Funcionalidades", "#funcionalidades"], ["Cómo funciona", "#como"], ["Planes", "#planes"]]],
              ["Ayuda", [["Preguntas frecuentes", "#ayuda"]]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <h4 className={`${MONO} mb-4 text-[13px] font-medium uppercase tracking-[.14em] text-[#6B615A]`}>{title}</h4>
                {(links as string[][]).map(([l, href]) => (
                  <a key={l} href={href} className="mb-[11px] block text-[15px] text-[#221C18] transition-all hover:pl-1 hover:text-[#F87604]">{l}</a>
                ))}
                {title === "Ayuda" && <button onClick={() => openModal()} className="mb-[11px] block text-[15px] text-[#221C18] transition-all hover:pl-1 hover:text-[#F87604]">Contacto</button>}
              </div>
            ))}
            <div>
              <h4 className={`${MONO} mb-4 text-[13px] font-medium uppercase tracking-[.14em] text-[#6B615A]`}>Empieza</h4>
              <Link href="/login" className="mb-[11px] block text-[15px] text-[#221C18] transition-all hover:pl-1 hover:text-[#F87604]">Iniciar sesión</Link>
              <button onClick={() => openModal()} className="mb-[11px] block text-[15px] text-[#221C18] transition-all hover:pl-1 hover:text-[#F87604]">Contacta a un ejecutivo</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3.5 pt-7">
            <small className="text-[13.5px] text-[#6B615A]">© 2026 MESA · Chile</small>
            <div className="flex gap-[22px]">
              <a href="#legal" className="text-[13.5px] text-[#6B615A] transition-colors hover:text-[#221C18]">Términos</a>
              <a href="#legal" className="text-[13.5px] text-[#6B615A] transition-colors hover:text-[#221C18]">Privacidad</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ---------- MODAL CONTACTO ---------- */}
      <div
        className={`fixed inset-0 z-[200] flex items-center justify-center p-5 transition-[opacity,visibility] duration-300 ${modalOpen ? "visible opacity-100" : "invisible opacity-0"}`}
        style={{ background: "rgba(34,28,24,.55)", backdropFilter: "blur(5px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
      >
        <div className={`relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-[28px] bg-white p-10 shadow-[0_30px_70px_rgba(34,28,24,.16)] transition-transform duration-300 max-md:p-[22px] ${modalOpen ? "translate-y-0 scale-100" : "translate-y-4 scale-[.985]"}`}>
          <button className="absolute right-[22px] top-[22px] grid h-[38px] w-[38px] place-items-center rounded-full border-[1.5px] border-[#ECE3D8] bg-white text-[#6B615A] transition-all hover:rotate-90 hover:border-[#221C18] hover:text-[#221C18] max-md:right-4 max-md:top-4" aria-label="Cerrar" onClick={() => setModalOpen(false)}>
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          {!modalSent ? (
            <div>
              <h3 className={`${DISP} pr-11 text-[1.9rem] font-semibold tracking-[-.01em] max-md:text-[1.55rem]`}>Contacta a un ejecutivo</h3>
              <p className="mt-2.5 mb-[26px] max-w-[42ch] text-[15px] text-[#6B615A]">Cuéntanos de tu local y te contactamos con una propuesta a tu medida.</p>
              {[["Nombre del local", "Café Aurora"], ["Tu nombre", "Nombre y apellido"], ["Correo o teléfono", "hola@local.cl / +56 9 ..."]].map(([label, ph]) => (
                <div key={label} className="mb-[18px]">
                  <label className="mb-2 block text-[14px] font-semibold text-[#221C18]">{label}</label>
                  <input type="text" placeholder={ph} className="w-full rounded-xl border-[1.5px] border-[#ECE3D8] bg-white px-[15px] py-[13px] text-[15px] text-[#221C18] outline-none transition-all placeholder:text-[#A79C92] focus:border-[#F87604] focus:shadow-[0_0_0_3px_rgba(248,118,4,.13)]" />
                </div>
              ))}
              <div className="mb-[18px]">
                <label className="mb-2 block text-[14px] font-semibold text-[#221C18]">¿Cuántas mesas tiene tu local?</label>
                <select value={modalMesas} onChange={(e) => setModalMesas(e.target.value)} className="w-full cursor-pointer appearance-none rounded-xl border-[1.5px] border-[#ECE3D8] bg-white px-[15px] py-[13px] pr-[42px] text-[15px] text-[#221C18] outline-none transition-all focus:border-[#F87604] focus:shadow-[0_0_0_3px_rgba(248,118,4,.13)]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236B615A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}>
                  <option>1 – 15 mesas</option><option>16 – 50 mesas</option><option>50 – 100 mesas</option><option>100+ o varias sucursales</option>
                </select>
              </div>
              <button className={`${btnClass("primary")} mt-2 w-full py-[1.05em]`} onClick={() => setModalSent(true)}>Enviar solicitud</button>
            </div>
          ) : (
            <div className="py-3 text-center">
              <div className="mx-auto mb-[18px] grid h-[62px] w-[62px] place-items-center rounded-full bg-[#1C4D43]/10 text-[#1C4D43]"><svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg></div>
              <h3 className={`${DISP} text-[1.9rem] font-semibold max-md:text-[1.55rem]`}>¡Solicitud enviada!</h3>
              <p className="mx-auto mt-2.5 max-w-[34ch] text-[15px] text-[#6B615A]">Un ejecutivo de MESA te contactará a la brevedad.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* Mini-preview del menú del cliente (estático, look oscuro real de la app). */
function PhonePreview() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-[#0a0908] text-white">
      <div className="flex flex-1 flex-col p-[18px] pt-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border-[1.5px] border-[#f87604] bg-[#161310]">
            <LogoMark className="h-[22px] w-[22px] text-white" />
          </div>
          <h3 className={`${DISP} min-w-0 flex-1 truncate text-[15px] font-bold leading-tight`}>La Parrilla de Benja</h3>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-[#f87604] px-2.5 py-1 text-[10px] font-bold text-[#2a1705]">Mesa 1</span>
          <small className="text-[10px] text-[#8a8178]">· Comensal 1</small>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#241f19] bg-[#15120f] px-3 py-2.5 text-[#7d756c]">
          <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <span className="text-[11px]">Buscar platos…</span>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-hidden">
          {["Todos", "Pizza", "Bebidas"].map((c, i) => (
            <span key={c} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${i === 0 ? "bg-[#f87604] text-[#2a1705]" : "bg-[#1a1714] text-[#b0a89f]"}`}>{c}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-1 flex-col gap-2.5">
          {[["Pizza", "Desde $2.500", "from-orange-500 to-red-700"], ["Café", "Desde $1.200", "from-amber-700 to-stone-900"]].map(([n, p, grad]) => (
            <div key={n} className="flex items-center gap-2.5 rounded-[16px] border border-[#241f19] bg-[#161310] p-2.5">
              <div className={`h-[42px] w-[52px] shrink-0 rounded-[10px] bg-gradient-to-br ${grad}`} />
              <div className="min-w-0 flex-1">
                <b className="block text-[12px] font-bold">{n}</b>
                <span className="mt-1 block text-[12px] font-bold text-[#f87604]">{p}</span>
              </div>
              <button className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f87604] text-[18px] leading-none text-white">+</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
