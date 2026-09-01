# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Todos los tipos de huéspedes se tratan con igual prioridad: empresas y trabajadores del sector minero, turistas, viajeros de trabajo, familias y público general. "Empresas" es una categoría de cliente diferenciada (con su propio flujo de cotización y datos de empresa), no una audiencia preferente sobre las demás. (Confirmado con el usuario el 2026-08-21.)

## Product Purpose

Vista Valle Lodging House es un alojamiento boutique de 3 habitaciones en Illapel, Región de Coquimbo, Chile. El sitio debe presentar las instalaciones y permitir que los huéspedes consulten disponibilidad, reserven y completen el proceso de reserva directamente desde la web, sin depender de intermediarios (Airbnb, Booking, teléfono, WhatsApp). Éxito significa aumentar las reservas directas y darle a Vista Valle control sobre la relación con sus huéspedes.

## Positioning

Canal de venta directa para un alojamiento boutique de 3 habitaciones que compite con las OTAs (Airbnb/Booking) ofreciendo consulta de disponibilidad y confirmación de reserva inmediata sin intermediarios, con una oferta diferenciada (no exclusiva) para empresas que necesitan alojamiento para trabajadores o colaboradores en la zona minera de Illapel.

## Operating Context

- Ubicación: Illapel, Región de Coquimbo, Chile.
- Canales de reserva a coordinar manualmente: sitio propio, Airbnb, Booking, teléfono, WhatsApp. El panel `/admin` debe permitir registrar reservas recibidas por cualquiera de estos canales y bloquear manualmente las fechas correspondientes en los demás canales cuando se reserva por la web (sincronización manual, no automática).
- Alcance de pago: el MVP original solo ofrecía confirmación inmediata de reserva con **pago al llegar** (pay-at-property); el pago online quedaba fuera de alcance (`openspec/changes/build-vista-valle-booking-mvp/proposal.md`, confirmado con el usuario el 2026-08-21). Esto cambió: el pago online ya no está fuera de alcance. **Fintoc Checkout** es el primer proveedor de pago online habilitado (una segunda modalidad junto a pago al llegar, no un reemplazo); Mercado Pago Checkout Pro queda planeado como un segundo proveedor en una fase posterior, para que ambos convivan como opciones para el huésped (ver `openspec/changes/add-fintoc-online-payment/proposal.md`).
- Existe un asistente de calendario en español (determinista/mock en este MVP, sin proveedor de IA conectado todavía) que interpreta instrucciones para proponer bloqueos de fechas (`CREATE_ROOM_BLOCK`); nunca ejecuta directamente — siempre exige revalidación determinista y confirmación humana.
- Contexto `mock`: los fixtures comerciales usados durante el desarrollo están explícitamente aislados en el código (marcados `isDemonstration: true`) para validar el frontend completo; nunca se publican ni activan en producción.

## Capabilities and Constraints

- Catálogo de habitaciones configurable. Actualmente 3 habitaciones, pero la arquitectura no debe asumir que siempre serán 3.
- Disponibilidad por habitación con bloqueos de calendario y prevención transaccional de reservas superpuestas; nunca confiar únicamente en la validación de frontend para disponibilidad, precio, capacidad, autorización o estado de pago.
- Fechas de alojamiento almacenadas como valores de solo fecha interpretados en `America/Santiago`; timestamps técnicos de eventos en UTC.
- Estados de reserva: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED` (opcionalmente `NO_SHOW`).
- Explícitamente fuera de alcance del MVP actual: sincronización automática con Airbnb/Booking, channel manager, tarifas dinámicas, CMS completo, analítica avanzada, múltiples roles administrativos, microservicios, GraphQL, Redis. El pago online ya no está en esta lista: Fintoc Checkout está habilitado como primer proveedor (ver Operating Context); Mercado Pago sigue pendiente para una fase posterior.
- Arquitectura vigente (ya implementada, no es una decisión abierta): monolito modular en Next.js + TypeScript + Tailwind CSS; Atomic Design en la capa de presentación; organización feature-first para la lógica de negocio (`src/features/*`); PostgreSQL vía Drizzle ORM; Supabase Auth y Storage; proveedores externos detrás de adaptadores tipados con secretos server-only. Ver `AGENTS.md` para las reglas de ingeniería completas vigentes.

## Brand Commitments

- Nombre: "Vista Valle — Lodging House".
- Logo oficial disponible en `public/brand/` (`vista-valle-logo.png`, `vista-valle-logo-white.png`, `vista-valle-logo-ST.png`).
- Tono de comunicación: cercano pero profesional; evitar lenguaje corporativo. Conceptos a transmitir: descanso, tranquilidad, comodidad, vista, hospitalidad, confianza, seguridad, atención personalizada.
- Ya existe una identidad visual derivada del logo, documentada en `design-system/vista-valle/MASTER.md` (paleta cálida negro/gris oscuro, beige, crema, blanco cálido y tonos tierra; tipografía Cormorant + Montserrat), aunque ese documento la marca como pendiente de "revalidar cuando lleguen los assets oficiales del logo" — los archivos de logo ya están presentes en `public/brand/` pero esa revalidación no consta como hecha.

## Evidence on Hand

- Fotografías reales de las 3 habitaciones en `public/rooms/` (`room-1.jpeg`, `room-2.jpeg`, `room-3.jpeg`) y fondos/panorámicas del lugar en `public/brand/` (`bg-hero.jpg`, `panoramic-bg.png`).
- **Pendiente — no inventar:** nombres definitivos de habitaciones, precios reales por noche, características y servicios exactos de cada habitación, dirección exacta, teléfono, WhatsApp, correo, Instagram, horarios de check-in/check-out, política de cancelación, política de niños/mascotas, datos tributarios, link de Google Maps. (Confirmado con el usuario el 2026-08-21: esta información sigue sin definirse.)
- Mientras no llegan los datos reales, se puede seguir trabajando con la información de referencia ya presente en `src/features/rooms/mock-fixtures.ts` (marcada `isDemonstration: true`), pero no debe presentarse como definitiva ni usarse en producción.

## Product Principles

1. La reserva directa es el objetivo comercial central: minimizar los pasos entre "busco dónde alojarme en Illapel" y "reservé mi habitación en Vista Valle".
2. Nunca confiar en el cliente para disponibilidad, precio, capacidad, autorización o estado de pago — todo se valida y confirma en el backend.
3. Todos los segmentos de huéspedes (empresas, turistas, viajeros de trabajo, familias, público general) se atienden con igual prioridad; "empresas" es una categoría de cliente con flujo propio, no una audiencia preferente.
4. No inventar información comercial (precios, nombres, políticas, datos de contacto) que Vista Valle no haya entregado; usar datos de demostración explícitamente marcados como tales mientras se define lo real.
5. Diseño mobile-first: gran parte de las reservas se realizarán desde el teléfono, con botones principales grandes y fáciles de usar en pantalla táctil.

## Accessibility & Inclusion

HTML semántico, contraste correcto, alt text en imágenes, navegación por teclado, labels en formularios y estados de focus visibles — ya reflejado como requisito en `design-system/vista-valle/MASTER.md` y en el brief original.
