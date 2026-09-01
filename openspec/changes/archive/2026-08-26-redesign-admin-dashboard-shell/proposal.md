## Why

El panel admin actual (`app/(admin-protected)/admin`) usa una barra de navegación horizontal simple y hereda la paleta cálida del sitio público de reservas (piedra/ámbar, DM Serif Display). El diseñador entregó una propuesta visual completa para el panel — sidebar fijo, tarjetas KPI, tabla de reservas recientes, feedback de carga con skeletons — pensada como una plataforma de gestión interna, deliberadamente separada del sitio público. Esta referencia vive en `proposes/admin-dashboard-design-notes.md` y `design/admin-dashboards/*.dc.html`.

## What Changes

- Se reemplaza el shell de navegación del admin: sidebar fijo con secciones agrupadas en escritorio, riel de solo iconos (64px) en tablet, y barra inferior de 5 accesos + botón "Actualizar datos" de ancho completo en móvil.
- Se introduce un tema visual del admin totalmente aislado del sitio público: mismas variables CSS (`--color-*`, `--font-*`) redefinidas dentro de un scope `data-theme="admin"` que envuelve `AdminShell`, de forma que todas las pantallas admin existentes (Calendario, Reservas, Bloqueos, Sincronizaciones, Alertas, Asistente) hereden la paleta y tipografía nuevas sin modificar su JSX ni su lógica.
- Se rediseña la pantalla "Resumen" (`/admin`): reemplaza las métricas actuales (bloqueos de canales pendientes, pagos al llegar pendientes, notificaciones fallidas) por tarjetas KPI de ocupación hoy (%), reservas activas, pagos pendientes ($) y alertas abiertas, más una tabla de reservas recientes (huésped, habitación, entrada, salida, estado, monto).
- Se amplía el contrato del mock administrativo de reservas con `createdAt`, `totalClp` y `paymentStatus`, exclusivamente para ordenar reservas y calcular pagos pendientes sin inventar datos ni conectar producción.
- Se agrega feedback de carga consistente: skeletons con shimmer en tarjetas KPI y filas de tabla mientras cargan datos reales, y un botón "Actualizar datos" con estado de carga (ícono reemplazado por spinner, deshabilitado, texto conservado o cambiado a "Actualizando…", nunca solo el spinner).
- **BREAKING**: se elimina la función `getAdminOperationalSummary()` actual (bloqueos/pagos al llegar/notificaciones) y se reemplaza por un agregado nuevo con las métricas del mock; cualquier consumidor de la forma de datos anterior deja de funcionar.
- No incluido en este change: las entradas de navegación "Clientes" y "Pagos" del mock no se agregan todavía (quedan fuera del sidebar hasta que se especifique su contenido); el detalle visual de Calendario, Reservas, Bloqueos, Sincronizaciones, Alertas y Asistente no se rediseña más allá de heredar los tokens de color/tipografía del nuevo tema.

## Capabilities

### New Capabilities
- `admin-dashboard-shell`: estructura visual del shell administrativo (sidebar/riel/bottom-nav, tema aislado del sitio público, feedback de carga) y el contenido de la pantalla Resumen (KPIs operativos y tabla de reservas recientes).

### Modified Capabilities

(ninguna — `reservation-administration` aún no existe como capability archivada en `openspec/specs/`; sigue en desarrollo dentro de `build-vista-valle-booking-mvp` y no se toca en este change)

## Impact

- `src/features/admin/admin-shell.tsx`: reescritura del shell de navegación (sidebar/riel/bottom-nav).
- `src/features/admin/dashboard.ts`: reemplazo del agregado `getAdminOperationalSummary()` por el nuevo cálculo de ocupación/reservas activas/pagos pendientes/alertas/reservas recientes.
- `src/features/admin/reservations.ts`: ampliación limitada del registro mock con fecha de creación, monto total y estado de pago.
- `app/(admin-protected)/admin/page.tsx`: nueva composición de tarjetas KPI + tabla.
- `app/(admin-protected)/admin/layout.tsx`: sin cambios de lógica, solo hereda el nuevo `AdminShell`.
- `app/globals.css`: nuevo bloque de variables bajo `[data-theme="admin"]` (colores, fuentes Manrope/Source Sans 3 vía Google Fonts, radios, colores de estado de reserva).
- No afecta el sitio público de reservas ni sus specs existentes.
