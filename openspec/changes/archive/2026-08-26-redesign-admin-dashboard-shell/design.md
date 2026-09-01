## Context

Ver `proposal.md` (Why) para la motivación. Puntos técnicos relevantes del estado actual:

- `src/features/admin/admin-shell.tsx` renderiza una nav horizontal simple con `bg-muted`/`bg-card`/`text-primary`, tokens definidos en `app/globals.css` bajo `:root`/`@theme` y compartidos con el sitio público.
- `src/features/admin/dashboard.ts` expone `getAdminOperationalSummary()`, que solo responde en contexto `"mock"` (siempre devuelve ceros) y `null` en `"production"`; no hay pipeline real contra Supabase todavía.
- `src/features/admin/reservations.ts` expone `getAdminReservationSource()`, también mock-only. Su contrato se amplía con `createdAt`, `totalClp` y `paymentStatus` para alimentar el agregado de Resumen; no existe todavía un conteo de habitaciones/inventario accesible desde el admin para calcular ocupación real.
- `app/(admin-protected)/admin/page.tsx` es un server component sin interactividad; el botón "Actualizar datos" y los skeletons del mock requieren estado de cliente, así que la pantalla necesita un límite server/client nuevo.
- La referencia exacta de valores (`design/admin-dashboards/Main.dc.html`, `Tablet.dc.html`, `Mobile.dc.html`) tiene colores/tipografía/radios literales en atributos `style`; se usan como fuente de verdad de tokens, no el PNG.

## Goals / Non-Goals

**Goals:**
- Shell de navegación responsivo (sidebar/riel/bottom-nav) reutilizable por todas las pantallas admin existentes.
- Tema visual del admin totalmente aislado del sitio público, sin duplicar nombres de utilidades Tailwind.
- Pantalla Resumen con KPIs y tabla de reservas recientes, alimentados por el mock existente (sin construir todavía el pipeline de producción).
- Skeletons y botón con estado de carga reutilizables.

**Non-Goals:**
- No se conecta el admin a datos reales de Supabase para ocupación/pagos (sigue mock-only, igual que hoy); el cálculo real es trabajo futuro fuera de este change.
- No se construyen las pantallas Clientes/Pagos (solo quedan fuera del nav, ver proposal.md).
- No se rediseña el layout interno de Calendario/Reservas/Bloqueos/Sincronizaciones/Alertas/Asistente; solo heredan los tokens de color/tipografía.

## Decisions

### 1. Aislamiento de tema vía scope de variables CSS, no vía nombres nuevos
Se añade en `app/globals.css` un bloque `[data-theme="admin"] { --color-primary: #1c2434; ...; --font-heading: ...; --font-sans: ...; }` con los mismos nombres de variable que ya usa `@theme`, y `AdminShell` envuelve todo su contenido en un elemento con `data-theme="admin"`. Las pantallas admin existentes siguen usando `bg-card`, `text-primary`, `border-border`, `font-heading` sin cambios de JSX y heredan los valores nuevos por cascada CSS.

**Alternativa descartada**: tokens con prefijo (`--admin-color-primary`) y clases utilitarias nuevas — más explícito pero obliga a tocar cada pantalla admin existente para lograr consistencia visual, lo cual excede el alcance (ver Non-Goals). Confirmado con el usuario durante exploración.

### 2. Tipografía Manrope + Source Sans 3 vía `next/font/google`
Se cargan ambas fuentes con `next/font/google` (igual patrón que las fuentes actuales del sitio público, ver `--font-montserrat`/`--font-dm-serif-display`), expuestas como variables CSS y referenciadas solo dentro del scope `[data-theme="admin"]`.

### 3. Reemplazo íntegro de `getAdminOperationalSummary()`
Se reescribe `src/features/admin/dashboard.ts` para calcular, en contexto `"mock"`, los cuatro KPIs a partir de `getAdminReservationSource().list()`: reservas activas = reservas cuyo estado no es cancelado; pagos pendientes = suma de `totalClp` de reservas con `paymentStatus` pendiente; alertas abiertas = se obtiene desde `operational-alerts.ts`; ocupación = placeholder calculado sobre el inventario mock disponible, documentado como aproximación hasta que haya inventario real. El contrato mock incorpora `createdAt`, `totalClp` y `paymentStatus` para que estas métricas y el orden de recientes sean deterministas, sin inventar datos ni construir un pipeline de producción. En contexto `"production"` sigue devolviendo `null`, igual que hoy, y la pantalla muestra el mensaje de "no disponible".

**Alternativa descartada**: mantener `getAdminOperationalSummary()` intacto y solo cambiar el JSX — se descartó en la exploración porque el mock no expone ninguna de las métricas nuevas.

### 4. División server/client de la pantalla Resumen
`page.tsx` sigue siendo server component y obtiene los datos iniciales; se introduce un client component (p. ej. `resumen-view.tsx`) que recibe los datos iniciales como prop, controla el estado de carga del botón "Actualizar datos" (re-fetch vía server action o route handler) y renderiza los skeletons mientras `loading` es verdadero. Mismo patrón que ya existe en el proyecto para otras vistas con interacción (ver `reservation-transition-controls.tsx`).

### 5. Sidebar/riel/bottom-nav como un único componente responsivo
`AdminShell` se reescribe para renderizar las tres variantes (sidebar de texto, riel de iconos, bottom-nav) usando los breakpoints existentes del proyecto (`tablet: 48rem`, `laptop: 64rem`) con utilidades Tailwind (`hidden tablet:flex`, etc.) en vez de tres componentes separados, para mantener una sola fuente de verdad de los ítems de navegación.

## Risks / Trade-offs

- [Cascada CSS mal aplicada deja alguna pantalla admin con colores mixtos] → Verificar visualmente cada pantalla admin existente tras el cambio de tema (Calendario, Reservas, Bloqueos, Sincronizaciones, Alertas, Asistente) antes de dar la tarea por completada.
- [El cálculo de ocupación con datos mock no representa ocupación real] → Se documenta explícitamente como aproximación en el código y en `tasks.md`; no bloquea este change porque el pipeline de producción es explícitamente Non-Goal.
- [Nueva carga de fuentes Google (Manrope, Source Sans 3) añade peso solo al admin] → Se restringe la carga a los layouts bajo `(admin-protected)`, no al layout raíz, para no afectar el rendimiento del sitio público.

## Migration Plan

- Cambio de código en un único change; no requiere migración de datos (el mock sigue siendo mock).
- Rollback: revertir el commit del change; no hay estado persistente nuevo que limpiar.
