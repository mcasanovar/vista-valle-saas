## Context

Ver `proposal.md` - Why. La consulta de ocupación por rango ya tiene soporte natural en el esquema: `reservations` y `reservation_holds` tienen índice `(roomId, checkIn, checkOut)` (más `expiresAt` en holds), y `room_blocks` tiene índice `(roomId, checkIn, checkOut)`. El patrón de fuente de datos para admin ya existe en `src/infrastructure/database/admin-reservation-source.ts`, usado por `/admin/reservas`, y el patrón de filtros por query params en `ReservationsFilterBar`. El tema visual admin (`[data-theme="admin"]` en `app/globals.css`) ya define tokens de color por estado de reserva, sidebar, shimmer de carga y skinning de `react-day-picker`.

## Goals / Non-Goals

**Goals:**
- Vista mobile-first: la agenda vertical es el layout base; el timeline de grid es la variante para pantallas anchas, no al revés.
- Reusar tokens de color, patrón de filtros por URL y flujos de creación manual existentes en vez de duplicarlos.
- Mantener el calendario legible con datos reales de producción para un rango de hasta ~5 habitaciones × 1 mes sin problemas de performance perceptible.

**Non-Goals:**
- Integración con el asistente de IA (`calendar-assistant`) — queda explícitamente fuera de este MVP por decisión del usuario.
- Drag-and-drop para mover o redimensionar reservas/bloqueos existentes — no se pidió y añade riesgo de validación (precio, disponibilidad, transacciones) sin valor confirmado todavía.
- Exportar/imprimir el calendario, vista de año completo.

## Decisions

### Patrón visual: grilla clásica (Mes/Semana/2 semanas) + timeline por habitación (Próximos 7 días)

**Revisión de la decisión original** (ver historial: se había elegido timeline
por recurso puro para evitar perder la comparación entre habitaciones). El
usuario pidió que la lectura de los días de una semana se sienta como un
calendario común: columnas fijas lunes–domingo, filas = semanas del rango,
número de día pequeño en la esquina superior derecha de cada celda (no
ocupando el cuadro completo).

Esto aplica a Mes, Semana y 2 semanas porque las tres son ventanas alineadas
a semana calendario. **Próximos 7 días se mantiene con el timeline por
habitación** (diseño original) porque es una ventana móvil desde "hoy" que no
empieza en lunes ni tiene un número fijo de semanas completas — forzarla a
columnas lun-dom produciría columnas parcialmente vacías al principio o al
final, y pierde el sentido de "ventana operativa de los próximos 7 días".

Dentro de cada celda de día de la grilla clásica, cada habitación ocupada
ese día se representa como un chip pequeño (mismo color/patrón por tipo que
ya teníamos: reserva por estado, retención con borde punteado, bloqueo con
patrón diagonal), en vez de una barra horizontal por habitación. El filtro
de habitación existente reduce cuántos chips aparecen por celda cuando la
densidad es alta.

Alternativa considerada: mantener el timeline por habitación en las tres
vistas y solo mejorar los encabezados de día — descartada porque no resuelve
el pedido explícito de "lunes a domingo por columna, semanas por fila".

### Mobile: agenda vertical, no timeline comprimido
Un timeline de 3-5 filas × ~30 columnas no cabe en 375px sin scroll horizontal, prohibido por las guías de layout del proyecto. Alternativa considerada: timeline horizontal con scroll — descartada porque el uso real es mayormente mobile (indicado por el usuario) y el scroll horizontal de contenido primario es un antipatrón conocido. La agenda vertical por día es el layout mobile-first; el timeline de grid es progressive enhancement para tablet/desktop (`md:` en adelante).

### Fuente de datos: nueva función de listado por rango, no reutilizar `admin-reservation-source.ts` tal cual
`admin-reservation-source.ts` está diseñado para listar reservas paginadas con filtros de detalle (no para consultar tres tablas distintas acotadas a un rango de fechas y agrupadas por habitación). Se crea una función de consulta específica para el calendario que:
1. Recibe rango de fechas + filtros opcionales (roomId, origin).
2. Consulta `reservations` (excluyendo `cancelled`), `reservation_holds` (excluyendo expirados) y `room_blocks` (excluyendo removidos) superpuestos al rango.
3. Devuelve los tres tipos normalizados a la misma forma de "item de calendario" (habitación, intervalo, tipo, origen/motivo, estado) para que la vista no necesite conocer el esquema de base de datos.

Esto preserva el límite de capas ya establecido en el proyecto (server-only data access separado de la vista) y evita acoplar el calendario al modelo de paginación de la lista de reservas.

### Colores: extender, no reemplazar, los tokens admin existentes
Se agregan `--admin-hold` y `--admin-block` (con sus `-background`) siguiendo el mismo patrón que `--admin-reservation-confirmed/pending/cancelled`. El origen se comunica con ícono, no color, para no competir con la semántica de estado ya establecida y para cumplir la regla de no depender solo del color.

### Animación: framer-motion, tokens de movimiento compartidos
`framer-motion` ya es dependencia del proyecto. Se define un módulo pequeño de tokens de motion (duración/easing) reusado por: transición de rango (slide direccional + crossfade, ~250-300ms), entrada de barras (fade + y:8px, stagger 20-30ms, sin overshoot), y panel de detalle (slide desde el borde de origen con spring). Todo dentro de un wrapper que respeta `prefers-reduced-motion` (ya sea vía `useReducedMotion` de framer-motion o el patrón CSS existente en el proyecto), colapsando a solo fade instantáneo.

### Interacción de creación rápida: click, no drag
La creación rápida se dispara con un clic/tap en una celda vacía (no arrastre para seleccionar un rango), evitando por diseño el requisito de accesibilidad de alternativa a drag. Si más adelante se quiere selección de rango por arrastre, deberá incluir la alternativa de un solo puntero exigida por WCAG 2.2 AA.

## Risks / Trade-offs

- [Riesgo] Confundir "retención" (hold) con "reserva" si el color no es suficientemente distinto → Mitigación: patrón visual adicional (borde punteado) además de color, más ícono/texto en el detalle.
- [Riesgo] Una celda de día con varias habitaciones ocupadas simultáneamente puede saturarse de chips y volverse difícil de leer, sobre todo en la fila compacta del calendario → Mitigación: los chips se truncan a un ancho fijo con texto elidido, y si no caben todos se muestra un indicador "+N" que abre el panel de detalle de esa celda en vez de listar todo inline; el filtro de habitación ya existente reduce la densidad cuando se necesita foco en una sola habitación.
- [Riesgo] La vista semanal comprimida con % de ocupación puede ocultar detalle relevante (ej. una única reserva larga que ocupa una semana completa igual que 7 reservas cortas) → Mitigación: al expandir la semana se ve el detalle diario; el resumen comprimido se documenta como vista de escaneo rápido, no como fuente de verdad.
- [Riesgo] Cambiar `getAdminCalendar` de mock-only a datos reales es un cambio **BREAKING** del comportamiento actual en el entorno mock (usado posiblemente en tests/demos) → Mitigación: mantener el modo mock disponible para el entorno de desarrollo/test, solo se elimina el `return null` en producción.
- [Trade-off] No incluir drag-and-drop reduce fricción de creación al no permitir "arrastrar para extender una reserva", pero se acepta porque no fue solicitado y el riesgo de validación (precio/disponibilidad) es alto para el valor no confirmado.

## Open Questions

- ¿La granularidad semanal comprimida en mobile se ofrece igual, o mobile solo tiene agenda diaria sin comprimir? No cambia los requisitos ya definidos (ambos se pueden implementar); se decide durante la implementación según cómo se vea en pantallas reales.
