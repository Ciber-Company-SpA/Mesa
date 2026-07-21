/**
 * Pasos del TOUR GUIADO de Manuel por el panel admin. El tour es un motor
 * determinístico del cliente (TourOverlay): navega a la ruta de cada paso y
 * muestra la tarjeta de Manuel explicando el módulo. Los pasos se filtran por
 * los módulos visibles del restaurante (useVisibleModules) — si el operador
 * apagó un módulo, el tour lo salta.
 *
 * Manuel lo lanza desde el chat con la herramienta `iniciar_tour`.
 */

export type TourStep = {
  /** Clave en platform_modules (para filtrar por visibilidad). null = siempre. */
  moduleKey: string | null
  /** Ruta a la que navega el paso. null = no navega (paso de cierre). */
  route: string | null
  emoji: string
  title: string
  text: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    moduleKey: "dashboard",
    route: "/admin",
    emoji: "🏠",
    title: "Resumen",
    text: "Tu punto de partida cada día: ventas del día, pedidos recientes y avisos importantes (como stock crítico) de un vistazo.",
  },
  {
    moduleKey: "categories",
    route: "/admin/categories",
    emoji: "🗂️",
    title: "Categorías",
    text: "Acá organizás tu carta en secciones (Hamburguesas, Bebidas, Postres…). El comensal navega el menú QR por estas categorías.",
  },
  {
    moduleKey: "products",
    route: "/admin/products",
    emoji: "🍔",
    title: "Productos",
    text: "El corazón de tu carta: creá productos con precio, foto (podés quitarle el fondo automáticamente), descripción y variantes. También podés importar tu menú con IA.",
  },
  {
    moduleKey: "promociones",
    route: "/admin/promociones",
    emoji: "🏷️",
    title: "Promociones",
    text: "Dos tipos: combo fijo (productos definidos a precio especial) y \"arma tu promo\" (el comensal elige por categoría y paga con % de descuento).",
  },
  {
    moduleKey: "descuentos",
    route: "/admin/descuentos",
    emoji: "🎟️",
    title: "Descuentos",
    text: "Cupones automáticos con reglas: día de la semana, horario, vigencia, monto mínimo. Se muestran solos al comensal cuando aplican — sin códigos que dictar.",
  },
  {
    moduleKey: "inventory",
    route: "/admin/inventory",
    emoji: "📦",
    title: "Inventario",
    text: "Insumos con stock y recetas por producto (la IA puede sugerirlas). Cada venta descuenta stock sola, y podés elegir si el stock agota productos del menú o solo te alerta.",
  },
  {
    moduleKey: "tables",
    route: "/admin/tables",
    emoji: "🪑",
    title: "Mesas",
    text: "Tus mesas con su código QR: generalos, descargalos e imprimilos. El comensal escanea el QR de su mesa y pide sin esperar al mesero.",
  },
  {
    moduleKey: "reservations",
    route: "/admin/reservations",
    emoji: "📅",
    title: "Reservas",
    text: "Reservá mesas por horario. Mientras una mesa está reservada, el QR no acepta pedidos de otros comensales.",
  },
  {
    moduleKey: "orders",
    route: "/admin/orders",
    emoji: "🧾",
    title: "Pedidos",
    text: "Todos los pedidos en vivo con su estado: Nuevo → Preparando → Listo → Pagado. La cocina tiene su propia pantalla (KDS) para trabajar los pedidos.",
  },
  {
    moduleKey: "waiters",
    route: "/admin/waiters",
    emoji: "🧑‍🍳",
    title: "Meseros",
    text: "Las cuentas de tu equipo: meseros y cocina. Cada uno recibe su acceso por correo y usa la app del mesero para atender mesas, cobrar y cerrar caja.",
  },
  {
    moduleKey: "reports",
    route: "/admin/reports",
    emoji: "📊",
    title: "Reportes",
    text: "Ventas por período, productos más vendidos, margen de ganancia por producto (según tus recetas) y horas peak. Los mismos datos que yo uso para recomendarte.",
  },
  {
    moduleKey: "pagos",
    route: "/admin/pagos",
    emoji: "💳",
    title: "Pagos",
    text: "Los datos tributarios de tu negocio, la conexión de tu pasarela para que el comensal pague en línea (Flow, Mercado Pago o Transbank) y tus documentos tributarios.",
  },
  {
    moduleKey: "settings",
    route: "/admin/settings",
    emoji: "⚙️",
    title: "Ajustes",
    text: "Nombre y logo del restaurante, plantilla del menú y si los pedidos entran directo a cocina, entre otros.",
  },
  {
    moduleKey: "plan",
    route: "/admin/plan",
    emoji: "⭐",
    title: "Mi plan",
    text: "Tu plan contratado y sus límites (mesas, funciones). Para cambios de plan, hablá con el equipo de MESA.",
  },
  {
    moduleKey: "soporte",
    route: "/admin/soporte",
    emoji: "🛟",
    title: "Soporte",
    text: "¿Algo no anda o tenés una duda que ni yo pude resolver? Abrí un ticket acá: el equipo de MESA te responde por chat en vivo.",
  },
  {
    moduleKey: "instalar",
    route: "/admin/instalar",
    emoji: "📲",
    title: "Instalar app",
    text: "Los instaladores de MESA: el panel para Windows y la app del mesero para Android. Se actualizan solos con cada mejora.",
  },
  {
    moduleKey: null,
    route: null,
    emoji: "🎉",
    title: "¡Eso es todo!",
    text: "Ya conocés el panel. Recordá que tu equipo usa la app del mesero (/waiter) y la cocina su pantalla KDS. Y para lo que necesites — crear cosas, analizar ventas o resolver dudas — acá estoy yo. ¡Pedime nomás!",
  },
]
