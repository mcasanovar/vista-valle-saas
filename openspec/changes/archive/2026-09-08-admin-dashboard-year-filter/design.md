## Context

Ver proposal.md - Why. Hoy `src/features/admin/dashboard.ts` resuelve un único `month: "YYYY-MM"` (`resolveAdminDashboardMonth`) y construye un rango `{from, to}` de ese mes (`monthRange`). Tanto el agregador de producción (`getAdminDashboardMonthlySummary` en `admin-dashboard-summary-source.ts`) como el agregador mock (`aggregateMockMonthlySummary`) ya reciben ese rango como `{from, to}` genérico - ninguno de los dos asume que el rango dura exactamente un mes. `everyDayOf`/`daysBetweenInclusive` tampoco lo asumen. Esto significa que el trabajo real es de resolución de período y de UI, no de reescribir las consultas de agregación.

`AdminDashboardView` (`src/features/admin/admin-dashboard-view.tsx`) es un client component: recibe `initialMonth`/`initialSummary` desde `app/(admin-protected)/admin/page.tsx` (server component) y refetchea via `GET /api/admin/dashboard?month=...` al cambiar de mes, actualizando la URL con `history.replaceState` (no `router.replace`, para no disparar el RSC/`loading.tsx` de Next).

## Goals / Non-Goals

**Goals:**
- Introducir un concepto de "período" (año completo, o un mes de un año) que reemplace el `month` actual en la resolución de datos, la API y la vista, preservando el comportamiento por defecto (mes vigente) cuando no se pasan parámetros.
- Reutilizar el agregador de rango `{from, to}` existente para el rango anual, sin tocar `admin-dashboard-summary-source.ts`.

**Non-Goals:**
- No se agrega una comparación año contra año ni un desglose mensual dentro de la vista anual (ej. "ventas por mes del año") - el gráfico de ventas sigue siendo por día, ahora sobre el rango del año cuando corresponde. Queda para un cambio posterior si se necesita.
- No se restringe el selector de año a años con datos existentes (igual que hoy el selector de mes permite navegar a cualquier mes, con o sin datos).

## Decisions

### 1. Modelo de período: `{ year: number; month: string | null }`

`AdminDashboardSummary.month: string` se reemplaza por `period: { year: number; month: string | null }`, donde `month` es `"YYYY-MM"` cuando hay un mes seleccionado, o `null` para "Año completo". `resolveAdminDashboardMonth(month?)` se reemplaza por `resolveAdminDashboardPeriod({ year?, month? })`, que:
- Sin `year` ni `month`: devuelve el mes vigente (mismo default de hoy).
- Con `month` (`YYYY-MM`) válido: usa ese año y mes, ignorando `year` si viene inconsistente con el mes.
- Con `year` y sin `month`: devuelve `{ year, month: null }` (año completo).

**Alternativa considerada:** mantener `month` como único campo y usar un valor sentinela (ej. `"2025-00"`) para "año completo". Se descarta por ser un valor de mes inválido que obligaría a cada consumidor de `month` a conocer el sentinela; un campo `month: string | null` explícito es más claro y evita el pattern-matching implícito.

### 2. Rango de fechas: nueva `yearRange(year)` junto a `monthRange(month)`

`dashboard.ts` agrega `yearRange(year): AdminDashboardMonthRange` (`{from: "YYYY-01-01", to: "YYYY-12-31"}`), análoga a `monthRange`. Ambas producen el mismo tipo `AdminDashboardMonthRange` que ya consume `getAdminDashboardMonthlySummary`/`aggregateMockMonthlySummary`, por lo que esas funciones no cambian. `getSummary(period)` elige `monthRange` o `yearRange` según `period.month`.

### 3. API: `year` y `month` como query params independientes

`GET /api/admin/dashboard` acepta `year` y `month` opcionales (hoy solo `month`). `month` sigue siendo `YYYY-MM` (autosuficiente); `year` solo importa cuando `month` está ausente. Un link antiguo con solo `?month=2025-03` sigue funcionando igual que hoy.

**Alternativa considerada:** un único parámetro `period` (ej. `2025` o `2025-03`). Se descarta porque `year`/`month` como parámetros separados mapea 1:1 con los dos selectores de la UI y evita parsear un formato compuesto en el cliente y el servidor.

### 4. UI: selector de año con flechas (como hoy el de mes), selector de mes como `<select>` con "Año completo"

- `YearSelector`: mismo patrón visual que el `MonthSelector` actual (flechas prev/next, ambas siempre habilitadas - no hay límite superior/inferior de año, igual que hoy no hay límite de mes).
- `MonthSelector` deja de ser flechas y pasa a ser un `<select>` con 13 opciones: "Año completo" + los 12 meses del año actualmente seleccionado (nombres, no números). Cambiar de año no cambia la opción de mes elegida por posición - si estaba en "Año completo" se mantiene "Año completo"; si estaba en un mes específico, cambiar de año mueve a ese mismo número de mes del nuevo año (ej. marzo 2025 → cambia año a 2024 → marzo 2024), salvo que el usuario haya llegado a "Año completo" primero.
- Elegir un año desde "Año completo" no fuerza ningún mes por defecto: la spec (`Selector de año`) exige que tras cambiar de año el mes vuelto a mostrar sea "Año completo", así que cambiar de año SIEMPRE resetea el mes a "Año completo", sin importar si antes había un mes específico seleccionado. Esto es más simple de razonar para el administrador (el año siempre aterriza en la vista agregada) y es literalmente lo que pide proposal.md.

**Alternativa considerada:** selector de mes también con flechas, reservando un extremo (ej. "antes de enero") para "Año completo". Se descarta: no es descubrible (nada indica que seguir presionando "mes anterior" desde enero lleva a un modo distinto), y con un `<select>` las 13 opciones son explícitas y accesibles por teclado/lector de pantalla sin sorpresas.

### 5. URL: `?year=YYYY` o `?year=YYYY&month=YYYY-MM`

`changeMonth`/el nuevo `changePeriod` en `AdminDashboardView` actualiza la URL con `history.replaceState` (mismo mecanismo ya usado, no `router.replace`) reflejando el período vigente: `?year=2025` para año completo, `?year=2025&month=2025-03` para un mes. La página server-side (`app/(admin-protected)/admin/page.tsx`) resuelve el período inicial desde ambos `searchParams`.

## Risks / Trade-offs

- [El gráfico de ventas por día sobre un año completo dibuja ~365 barras en el mismo ancho donde hoy caben ~31] → El componente ya es genérico en la cantidad de días (`chartWidth = days.length * slot`, con scroll horizontal implícito por su contenedor) y ya reduce las etiquetas de eje a cada 5 días cuando hay más de 20; con 365 días seguirá mostrando una etiqueta cada 5 días, legible pero con barras muy angostas. Aceptable para este cambio; si resulta poco útil en la práctica, un cambio posterior puede agregar una vista "por mes" del año en el mismo gráfico.
- [Cambiar de año siempre resetea a "Año completo", incluso si el administrador solo quería ver "el mismo mes del año pasado"] → Es el comportamiento pedido explícitamente en la descripción del filtro; comparar el mismo mes entre años queda fuera de alcance (ver Non-Goals).

## Migration Plan

Sin datos persistidos que migrar (cambio de UI/servidor, no de esquema de base de datos). Se implementa y despliega como una sola pieza: mientras no esté completo, el selector de mes actual sigue funcionando porque `month` como único query param se mantiene soportado.
