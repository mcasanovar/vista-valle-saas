## Why

Vista Valle necesita transformar su presencia digital en un canal de venta directa que permita descubrir sus habitaciones, consultar disponibilidad y completar reservas sin depender de intermediarios. El MVP debe centralizar las reservas propias y manuales de sus tres habitaciones, aceptar pagos reales y entregar al negocio un control operativo básico y seguro.

## What Changes

- Crear un sitio público mobile-first para presentar Vista Valle, sus habitaciones, servicios, ubicación y propuesta para empresas, con contenido preparado para SEO local. Durante el desarrollo se permiten fixtures comerciales ficticios, explícitamente aislados al contexto `mock`, para validar el front completo; nunca se publicarán ni se activarán en producción.
- Incorporar un catálogo configurable de habitaciones con galerías, capacidad, camas, servicios, precio y detalle individual.
- Implementar disponibilidad por habitación, bloqueos de calendario y prevención transaccional de reservas superpuestas, incluso cuando una reserva incluye varias habitaciones para las mismas fechas.
- Permitir que el huésped agregue una o más habitaciones disponibles a una misma reserva desde los resultados de búsqueda o desde su detalle, revise subtotales y total, y confirme con pago al llegar; el pago online mediante Mercado Pago Checkout Pro queda fuera de este MVP y se evaluará en una fase posterior.
- Permitir solicitar factura de forma opcional, exigiendo y validando los antecedentes tributarios chilenos solo cuando se seleccione esa opción; la emisión tributaria automatizada queda fuera de alcance.
- Enviar confirmaciones y avisos transaccionales de las reservas, incluyendo el detalle de todas las habitaciones y un destinatario tributario adicional cuando corresponda sin duplicar correos.
- Crear un panel administrativo básico para revisar el calendario y gestionar reservas, pagos presenciales, bloqueos y reservas recibidas desde Airbnb, Booking, teléfono o WhatsApp.
- Mostrar y registrar el trabajo pendiente de bloquear manualmente las fechas de una reserva web en Airbnb y Booking.
- Incorporar un asistente de calendario que interprete instrucciones en español para proponer cierres de fechas, valide conflictos y exija confirmación humana antes de crear el bloqueo.
- Organizar la interfaz con Atomic Design y la lógica del producto por capacidades de negocio.
- Mantener fuera del MVP el pago online mediante Mercado Pago Checkout Pro, un channel manager, tarifas dinámicas, CMS completo, analítica avanzada y múltiples roles administrativos. La sincronización bidireccional mediante iCal con Airbnb y Booking sí forma parte del alcance productivo de este cambio.

## Capabilities

### New Capabilities

- `public-lodging-site`: Experiencia pública responsive, contenido institucional, catálogo y detalle de habitaciones, ubicación, contacto, captación de empresas y fundamentos de SEO y accesibilidad.
- `booking-engine`: Consulta de disponibilidad, cálculo de estadía, carrito de una o más habitaciones con fechas compartidas, captura de huésped y antecedentes tributarios condicionales, reservas, bloqueos y prevención de superposiciones. Conserva de forma genérica el concepto de retención temporal como base para una fase futura de pago online.
- `payment-processing`: Seguimiento del estado de pago independiente del estado de la reserva y registro de pago presencial; la selección de modalidad de pago online mediante Checkout Pro queda fuera de este MVP.
- `reservation-administration`: Autenticación y panel básico para calendario, reservas manuales multicanal, bloqueos, cancelaciones, pagos presenciales y control de sincronización iCal automática y manual.
- `channel-calendar-sync`: Conexiones persistentes por habitación y plataforma, feeds iCal entrantes y salientes, sondeo programado, idempotencia, cancelación por desaparición, conflictos y comportamiento de pago específico para Airbnb y Booking.
- `calendar-assistant`: Interpretación mediante IA de instrucciones de cierre de fechas, resolución de ambigüedades, validación determinista, vista previa, confirmación y auditoría.
- `transactional-notifications`: Confirmaciones y alertas por correo para huéspedes, destinatarios tributarios y administradores, con entrega desacoplada del resultado de la reserva y deduplicación de destinatarios.

### Modified Capabilities

- Ninguna. El proyecto aún no contiene capacidades OpenSpec existentes.

## Impact

- Se creará una aplicación Next.js con TypeScript, Tailwind CSS y componentes organizados mediante Atomic Design.
- Se incorporarán PostgreSQL, Supabase Auth y Storage, Drizzle ORM y validación con Zod.
- Se integrará un asistente de calendario mock y determinista para validar la experiencia conversacional sin red ni credenciales de IA, además de un proveedor transaccional de correo. La conexión a un proveedor de modelos mediante Vercel AI SDK y Mercado Pago Checkout Pro quedan para cambios OpenSpec posteriores. La sincronización iCal de Airbnb y Booking se ejecutará con adaptadores persistentes y tareas programadas en producción; los dobles en memoria quedan limitados a pruebas automatizadas.
- Se añadirán rutas públicas, endpoints protegidos, panel administrativo, un esquema de reserva cabecera-ítems, datos tributarios condicionales y procesos operativos para sincronización manual de canales.
- Vista Valle deberá proporcionar fotografías, datos comerciales, información definitiva de habitaciones, precios, políticas y credenciales de los servicios externos antes de producción.
