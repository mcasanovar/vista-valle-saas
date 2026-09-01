## Context

Ver `proposal.md` (Why) para la motivación. Estado actual relevante:

- `src/features/admin/reservations.ts` (`createAdminReservationSource`) mantiene un único registro hardcodeado (`initial`) en memoria; `getAdminReservationSource()` devuelve `null` fuera de contexto `mock`.
- `app/(admin-protected)/admin/reservas/page.tsx` concatena esa fuente con `listMockReservationPaymentAdminViews()` (de `confirm-pay-at-property.ts`), otro repositorio mock separado que sí refleja reservas reales creadas en modo mock, pero nunca datos de Postgres.
- `app/(admin-protected)/admin/reservas/[id]/page.tsx` bifurca con `if/else` según cuál de las dos fuentes encontró el registro, mostrando conjuntos de campos distintos e incompletos en cada rama.
- `src/infrastructure/database/reservation-repository.ts` (`createDrizzleReservationRepository`) es la única implementación contra Postgres real, pero solo expone `getReservationById`, `createConfirmedPayAtPropertyReservation`, `createConfirmedPayNowReservation` y `transitionReservationState` — ninguna operación de listado, búsqueda o paginación.
- No existe ningún camino de producción para aprobar un pago `pay_at_property` (solo existe `pay-at-property-collection.ts`, cableado íntegramente al repositorio mock).
- El schema Drizzle (`reservations`, `reservation_items`, `guests`, `payments`, `payment_events`, `channel_sync_tasks`, `audit_events`) ya contiene todos los campos necesarios para listado, búsqueda, filtros y detalle; no se requiere ninguna migración de esquema.
- No existe en el proyecto ninguna librería de calendario ni un patrón de selector de rango de fechas; el sitio público usa dos `<input type="date">` independientes.
- El proyecto no usa `ilike`, `and`/`gte`/`lte` combinados, ni `limit`/`offset` en ningún módulo de infraestructura existente — este change introduce el primer listado paginado/buscable del proyecto.

## Goals / Non-Goals

**Goals:**
- Reemplazar por completo la fuente mock de reservas admin por una fuente de solo lectura contra Postgres, separada de la interfaz transaccional existente.
- Listado paginado (20 por página) con búsqueda de texto libre y filtros de fecha combinables, correcto para reservas multi-habitación.
- Vista de detalle completa (huésped, ítems, factura condicional, pagos, sincronización de canales, auditoría).
- Acciones de cancelar (permisivo respecto a fecha), marcar no-show, y registrar pago presencial — todas contra Postgres real.

**Non-Goals:**
- No se rediseña el calendario operativo (`/admin/calendario`) ni los bloqueos de habitación; este change es exclusivamente el módulo de reservas (listado + detalle + acciones).
- No se agrega búsqueda por comentario libre del huésped ni por campos de pago (proveedor, id de pasarela) en el buscador de texto libre.
- No se optimiza la búsqueda con índices trigram, columnas de búsqueda materializadas ni un motor de búsqueda externo; al volumen actual (una propiedad de 3 habitaciones), `ILIKE` sobre columnas indexadas normalmente es suficiente.
- No se automatiza ningún reembolso al cancelar una reserva ya pagada; sigue siendo una resolución financiera manual y separada (ya existente para Fintoc).

## Decisions

### 1. Fuente de lectura dedicada, separada de la interfaz transaccional
Se crea `src/infrastructure/database/admin-reservation-source.ts`, un módulo de solo lectura que no implementa `ReservationRepository<TContext>`. Sigue el patrón ya establecido por `booking-confirmation-source.ts`, `availability-source.ts` y `room-source.ts`: una composición de lectura específica para un consumidor específico, en vez de sobrecargar la interfaz transaccional (pensada para creación y transiciones de estado bajo lock de habitación) con listado/búsqueda/paginación, que tienen una forma de datos y de invalidación completamente distinta.

**Alternativa descartada**: agregar métodos de listado a `ReservationRepository<TContext>` — mezclaría preocupaciones transaccionales con preocupaciones de lectura paginada, y obligaría a la interfaz mock (si quedara alguna) a implementar paginación que nunca necesita.

### 2. Listado en dos fases para no romper la paginación con reservas multi-habitación
Una reserva puede tener N `reservation_items` (una fila por habitación). Si el listado paginado hiciera `JOIN reservation_items` directamente, una reserva de 2 habitaciones contaría como 2 filas, cortando reservas entre páginas y descuadrando el conteo total.

Fase 1 (liviana): `SELECT reservations.id` con `JOIN guests` para los predicados de búsqueda sobre huésped, más una subconsulta `EXISTS` contra `reservation_items JOIN rooms` solo para el predicado de nombre de habitación (sin traer sus columnas). Aplica los filtros de fecha (`checkIn`/`checkOut`, exactos o en rango) y de texto, ordena por `createdAt DESC`, pagina con `LIMIT`/`OFFSET`, y calcula el total con `COUNT(*)` bajo el mismo `WHERE`, sin el `LIMIT`.

Fase 2 (detalle liviano de la página): con los IDs exactos de la página actual, una segunda consulta trae reserva + huésped + todos los `reservation_items` (aquí sí puede haber varias filas por reserva; ya no afecta la paginación) para renderizar la tabla.

**Alternativa descartada**: `COUNT(*) OVER()` como ventana en una sola consulta — no resuelve el problema de fondo (duplicación de filas por ítem), solo lo oculta; seguiría inflando el conteo si no se deduplica primero.

### 3. Listado liviano, detalle pesado
La consulta de listado nunca hace `JOIN` contra `payments`, `payment_events`, `channel_sync_tasks` ni `audit_events` — esos solo se cargan en la consulta de detalle, para una única reserva. Mantiene el listado rápido incluso si una reserva acumula muchos eventos de pago o auditoría.

### 4. Búsqueda de texto libre con `ILIKE`, sin infraestructura de búsqueda dedicada
Al volumen esperado (una propiedad boutique de 3 habitaciones), un `ILIKE '%término%'` combinado con `OR` sobre las columnas de `guests` + el `EXISTS` de habitación es suficiente y no requiere índices trigram (`pg_trgm`) ni una columna de búsqueda materializada. Se documenta como decisión revisable si el volumen de reservas creciera órdenes de magnitud (cadena de propiedades, por ejemplo).

### 5. Filtro de fecha como rango único (`from`/`to`), fecha exacta como caso particular
Tanto el filtro de llegada como el de salida se modelan como `{ from?: string; to?: string }` en la capa de datos; una fecha exacta es simplemente `from === to`. La UI decide cómo se presenta (ver Decisión 7); la capa de consulta solo aplica `gte`/`lte` opcionales sobre `checkIn`/`checkOut`, sin necesidad de una bandera "modo exacto vs. rango".

### 6. Nueva acción de registro de pago presencial contra Postgres
Se agrega una función de infraestructura que localiza el pago `pending` de una reserva `pay_at_property` (`payments` donde `reservation_id` = X y `provider = 'pay_at_property'`), lo actualiza a `approved` con `received_at`, `payment_method` y `recorded_by_user_id`, y registra un evento de auditoría — siguiendo el mismo patrón que ya usa la acción de reembolso de Fintoc (`fintoc-refund-service.ts`) como referencia de estilo. Sin restricción de fecha: puede ejecutarse en cualquier momento después de creada la reserva.

### 7. Selector de fecha inteligente con librería de calendario de rango
Se incorpora una librería de calendario con soporte nativo de modo rango (ej. `react-day-picker`) para el selector de fecha único que permite elegir un día (fecha exacta) o un rango (arrastre o segundo click), en vez de construir un calendario accesible desde cero. Se carga únicamente en el bundle del admin (layout bajo `(admin-protected)`), sin afectar el sitio público.

**Alternativa descartada**: dos `<input type="date">` (Desde/Hasta) — más simple de construir, pero obliga al usuario a decidir explícitamente "modo exacto vs. rango" en vez de una interacción natural de calendario; se descartó en la exploración con el usuario.

### 8. Filtro de salida oculto, revelado en el mismo flujo vertical en todos los breakpoints
El filtro de fecha de salida permanece oculto tras "+ Agregar filtro de salida"; al revelarse, se apila verticalmente debajo del filtro de llegada en todos los tamaños de pantalla (no es un panel/hoja separado en tablet/móvil). Evita mantener dos implementaciones de revelado (inline en desktop, modal en móvil) para el mismo control.

### 9. Cancelación permisiva respecto a la fecha
No se agrega ninguna validación que impida cancelar una reserva `confirmed` cuya fecha de llegada ya haya pasado. La liberación de disponibilidad sigue siendo automática (ya derivada del `status = 'confirmed'` en las consultas de ocupación existentes, sin cambios). Cancelar una reserva ya pagada no dispara ningún reembolso automático — sigue la política ya establecida en `build-vista-valle-booking-mvp` (decisión 8): el panel debe señalar que requiere resolución financiera manual.

## Risks / Trade-offs

- [`ILIKE` sin índice dedicado puede degradar con miles de reservas] → Aceptable al volumen actual; revisar `pg_trgm`/índice GIN si el volumen crece significativamente. No bloquea este change.
- [La subconsulta `EXISTS` para nombre de habitación en la Fase 1 puede ser más costosa que un `JOIN` directo si hay muchas habitaciones] → Irrelevante al tamaño actual del catálogo (3 habitaciones); revisar si el catálogo crece mucho.
- [Agregar una librería de calendario introduce una dependencia nueva] → Se restringe explícitamente al bundle del admin protegido, sin impacto en el peso del sitio público.
- [Cancelar una reserva pagada sin bloquear ni automatizar el reembolso puede generar reservas "canceladas pero no reembolsadas" que se olviden] → Ya es una política aceptada; el detalle de reserva debe señalar visualmente un pago aprobado sobre una reserva cancelada como pendiente de resolución financiera.

## Migration Plan

- Cambio de código en un único change; no requiere migración de esquema (todas las columnas necesarias ya existen).
- Se elimina código mock existente (`src/features/admin/reservations.ts` y su uso); no hay datos que migrar porque nunca fueron reales.
- Rollback: revertir el commit del change; no hay estado persistente nuevo que limpiar más allá del código.
