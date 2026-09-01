## Context

Ver `proposal.md` — Why para la motivación. El proyecto Supabase real de Vista Valle (`ljwukpcwysvahqmrpwjd`, región `sa-east-1`) ya está creado, verificado como accesible y confirmado vacío (sin tablas en `public`). Las credenciales reales (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) ya están en `.env.local`. `DATABASE_URL` apunta al Transaction pooler (puerto 6543); además se cuenta con la cadena del Session pooler (puerto 5432) para uso puntual de migraciones. El correo del administrador real es `vistavallespa@gmail.com`.

`drizzle.config.ts` hoy solo define `dialect`, `out` y `schema` — no acepta credenciales de conexión, por lo que `drizzle-kit migrate`/`push` no pueden ejecutarse todavía. `scripts/run-postgres-integration.mjs` reconstruye el esquema de verificación reproduciendo únicamente `drizzle/0000_thin_paper_doll.sql`, aunque existen migraciones posteriores (`0001`–`0003`) que agregan `company_quotations` y `reservation_items`. Además, `reservations` no tiene índice sobre `(check_in, check_out)` pese a ser el rango que las consultas de disponibilidad cruzan contra `reservation_items`.

## Goals / Non-Goals

**Goals:**
- Dejar el esquema completo de Drizzle aplicado y verificable en el proyecto Supabase real.
- Dejar Auth, RLS y Storage configurados y operativos en ese proyecto.
- Cerrar la brecha entre lo que la suite de integración verifica y el esquema real vigente.
- Cargar el contenido real de las tres habitaciones en la base y el bucket reales.

**Non-Goals:**
- No se configura el despliegue en Vercel ni sus variables de entorno remotas (se documentan, no se aplican).
- No se activa `BOOKING_ENABLED` ni el contexto productivo de la aplicación en este cambio; el objetivo es dejar la infraestructura lista y verificada, no abrir reservas.
- No se gestionan dominio, remitente de Resend ni proveedor de IA (excluidos explícitamente por el usuario).
- No se implementa pago online ni ningún alcance ya diferido por `build-vista-valle-booking-mvp`.

## Decisions

### 1. Conexión de migraciones vía variable de entorno explícita, no hardcodeada en `drizzle.config.ts`
`drizzle.config.ts` leerá `DATABASE_URL` (u otra variable dedicada si conviene distinguir el pooler de sesión del de transacción) al momento de ejecutar `db:migrate`, en vez de commitear ninguna cadena de conexión. El script de migración usará explícitamente el **Session pooler** (5432), no el Transaction pooler (6543) que usa el runtime: el modo transacción de PgBouncer no soporta de forma confiable las sentencias preparadas que `drizzle-kit migrate` necesita.

**Alternativa considerada:** usar siempre el Transaction pooler para todo — se descarta porque puede fallar silenciosamente o de forma intermitente al migrar bajo PgBouncer en modo transacción.

### 2. Índice sobre `reservations(check_in, check_out)` antes de migrar

Se agrega el índice al esquema de Drizzle y se genera como una migración nueva (posterior a `0003`), en vez de aplicarlo manualmente por SQL suelto contra el proyecto real. Así queda versionado como el resto del esquema y cubierto por el mismo mecanismo de migración e integración de este cambio.

**Alternativa considerada:** aplicarlo directo con SQL en el proyecto real - se descarta porque quedaría fuera del historial de migraciones y divergiría del esquema declarado en `schema.ts`.

### 3. Extender el harness de integración para reproducir todas las migraciones, no reescribirlo
`scripts/run-postgres-integration.mjs` pasará de reproducir un único archivo a iterar los archivos de `drizzle/` en orden (según `drizzle/meta/_journal.json`), aplicando cada uno con el mismo mecanismo de `statement-breakpoint` ya usado. Esto mantiene el enfoque actual (reset + replay determinista) y solo cierra la brecha de cobertura.

**Alternativa considerada:** apuntar el harness directamente al proyecto Supabase real - se descarta porque el harness debe seguir siendo aislado y repetible sin afectar el proyecto real ni depender de su disponibilidad.

### 4. Carga de contenido real mediante script único idempotente, no vía consola manual
Se escribirá un script server-only que use el `service_role` key para: subir las fotografías reales al bucket de Storage, y hacer upsert de las tres habitaciones (datos + referencias a imágenes subidas) en la tabla `rooms`, reemplazando los fixtures de demostración como fuente para el catálogo bajo contexto `production`. El script será idempotente (upsert por slug) para poder corregir contenido sin duplicar registros.

**Alternativa considerada:** cargar el contenido a mano desde el dashboard de Supabase - se descarta porque no queda registrado ni es repetible si hay que corregir datos.

### 5. RLS y Storage se aplican como SQL versionado ya existente, sin cambios de contenido
`supabase/rls/operational-tables.sql` y `supabase/storage/room-images.sql` ya están escritos y alineados con el esquema; se aplican tal cual contra el proyecto real (vía SQL editor o `psql`), sin modificarlos como parte de este cambio.

### 6. Repositorio de habitaciones en producción (hallazgo durante el apply, no anticipado en el diseño original)
Al verificar la conexión productiva completa (paso 8 del plan de migración) se encontró que `getRoomReadSource()` (`src/features/rooms/source.ts`) construía la fuente de datos con un arreglo vacío hardcodeado bajo `production` — no existía ninguna consulta a Postgres para el catálogo/detalle público, solo `room-lock.ts` consulta `rooms`, y únicamente por ID para bloqueo transaccional. Sin esto, cargar contenido real (decisión 3) no tendría ningún efecto visible en el sitio público.

Se agrega `src/infrastructure/database/room-source.ts` (mismo patrón que `company-quotation-source.ts`): consulta `rooms` activas + `room_images` (ordenadas por posición) + `room_amenities`/`amenities`, y reutiliza `createRoomImageStorage().getPublicUrl()` para las URLs de Storage en vez de construirlas a mano. `getRoomReadSource()` pasa a ser `async`, lo que obliga a `await` en sus ~14 puntos de llamada (páginas, rutas API, servicios de disponibilidad/reservas/notificaciones); se optó por esto en vez de mantener `RoomReadSource` síncrono con un caché precalculado, porque cada solicitud debe reflejar el estado real de la base sin una capa de invalidación adicional.

También se amplió `isPublishableRoom` (`read-model.ts`) para aceptar imágenes con URL absoluta `https://` además de rutas locales `/...`, ya que las imágenes reales en Storage nunca empiezan con `/`.

**Alternativa considerada:** mantener `RoomReadSource` síncrono y resolver la promesa antes en un wrapper - se descarta porque igual requeriría cambiar la firma en cada punto de llamada, sin ganar nada en simplicidad.

### 7. Bugs encontrados en la verificación visual final (7.3), no anticipados en el diseño original
La revisión en navegador con datos reales (no solo por consulta SQL) reveló dos problemas que ninguna verificación anterior en este cambio habría detectado:

- **Ruta de Storage con slug en vez de UUID**: `scripts/load-room-content.mjs` guardaba `rooms/<slug>/<n>.<ext>`, pero `assertRoomImagePath` (`src/infrastructure/storage/contracts.ts`) exige `rooms/<UUID>/<archivo>` para todas las imágenes de habitación, mock o real. Se corrigió el script para usar el `id` real de la habitación devuelto por el upsert, se resubieron las fotos ya cargadas con la ruta correcta y se eliminaron los objetos huérfanos con la ruta vieja.
- **`next.config.ts` sin `images.remotePatterns`**: nunca hizo falta porque ninguna imagen productiva de Supabase Storage se había renderizado antes de este cambio. Se agregó, derivando el host permitido de `NEXT_PUBLIC_SUPABASE_URL` en tiempo de configuración, en vez de codificar el hostname del proyecto a mano.

**Lección para este tipo de cambio:** verificar por consulta SQL que los datos "existen" no es equivalente a verificar que la aplicación real los sirve correctamente; ambos bugs solo se manifestaban al renderizar la página de verdad.

### 8. Nuevo átomo `Skeleton`, reutilizando `Button` con `loading` para acciones
Hoy no existe ningún componente de skeleton en `src/presentation/atoms` (solo `LoadingState`/`Spinner`, pensados para texto en línea, no para reflejar la forma de tarjetas o layouts). Se agrega un átomo `Skeleton` reutilizable (bloques con animación de pulso, dimensionables por `className`) y se compone en cada superficie de carga de datos (tarjetas del catálogo, layout de detalle, resultados de disponibilidad). Para botones y navegación se reutiliza el `loading` que `Button` ya soporta (con `Spinner`) — no se introduce un mecanismo nuevo para ese caso, solo se audita que todo botón relevante ya lo use.

**Alternativa considerada:** un overlay de carga a pantalla completa para toda operación pendiente - se descarta explícitamente por el requisito: las acciones de botón/navegación no deben bloquear ni cubrir la pantalla completa.

### 9. Repositorio de disponibilidad en producción (hallazgo posterior al cierre del cambio)
Con `VISTA_VALLE_CONFIG_CONTEXT=production` activo de forma persistente (decisión del usuario, ver Risks), la búsqueda de disponibilidad fallaba siempre: `getAvailabilitySearchRepository()` tenía el mismo patrón de fail-closed que ya se había corregido para habitaciones (decisión 6), pero nadie lo había cerrado para disponibilidad.

En vez de escribir una consulta nueva, se extrajo la función `listOccupyingIntervals` que ya existía —privada— dentro de `src/infrastructure/database/room-lock.ts`, usada por la transacción de bloqueo (tarea 4.4 del MVP) para calcular reservas confirmadas, holds vigentes y bloqueos activos de una habitación. Se exportó con un tipo `QueryableDatabase` (subconjunto estructural de `ProductionDatabase`) para que funcione tanto dentro de una transacción como con la conexión de solo lectura de la búsqueda pública. Así, la búsqueda de disponibilidad y el chequeo autoritativo que corre al confirmar una reserva comparten exactamente la misma definición de "qué ocupa una habitación", sin duplicar la consulta.

`createAvailabilitySearchRepository("production")` se dejó sin tocar — sigue lanzando `AvailabilitySearchSourceUnavailableError`, tal como lo verifica su test existente — porque `getAvailabilitySearchRepository()` ahora decide por `createDatabaseBoundary()` en vez de pasar por esa función para el caso productivo.

**Alternativa considerada:** duplicar la consulta de ocupación en el nuevo repositorio de disponibilidad - se descarta porque divergiría con el tiempo del chequeo autoritativo de la transacción de bloqueo, arriesgando que la búsqueda muestre disponibilidad que la reserva real rechazaría (o viceversa).

### 10. Escritura real de reservas en producción (hallazgo posterior al cierre del cambio)
Confirmar una reserva real fallaba con 503 por dos fail-closed independientes: el comando de confirmación (`getPayAtPropertyBookingConfirmationService`) y el limitador de tasa de reservas públicas (`getPublicBookingRequestLimiter`). El primero es del mismo tipo que los de habitaciones/disponibilidad (nadie lo cerró); el segundo es distinto — es una decisión de seguridad deliberada y documentada en el propio código ("no pretender que un contador de un solo proceso protege un despliegue multi-instancia").

Para el comando de confirmación, las piezas Drizzle ya existían y estaban completas (`createDrizzleRoomLockGateway`, `createDrizzleGuestRepository`, `createDrizzleReservationRepository` — de las tareas 4.4/6 del MVP) pero nunca se habían conectado entre sí para producción. Se extrajo un núcleo genérico `confirmPayAtPropertyBookingWith<TContext>` parametrizado por esas dependencias, dejando `confirmPayAtPropertyBooking` (mock) como envoltorio de compatibilidad para los tests existentes, y se armó el envoltorio productivo en `getPayAtPropertyBookingConfirmationService()`. `createPayAtPropertyBookingConfirmationService("production")` se dejó intacto (sigue lanzando `BookingConfirmationUnavailableError`, cubierto por su test), mismo patrón que las decisiones 6 y 9.

Para el limitador, se consultó explícitamente al usuario en vez de decidir unilateralmente, dado que es un control de seguridad y no solo un adaptador faltante. Decisión: reutilizar el limitador en memoria en producción mientras el despliegue sea un solo proceso (ver Risks), documentando en el código que debe reemplazarse por un adaptador compartido antes de escalar a múltiples instancias serverless. La misma justificación de "un solo proceso por ahora" se aplicó, sin volver a preguntar, a la tienda de idempotencia de reservas (`mockIdempotencyStore`), que tiene exactamente el mismo perfil de riesgo y ya estaba documentada como tal.

**Alternativa considerada:** seguir fallando cerrado en el limitador hasta tener un adaptador compartido real - se descarta porque bloquearía todas las reservas reales indefinidamente sin necesidad, dado que el despliegue actual (un solo proceso) es exactamente el caso en que el limitador en memoria sí protege correctamente.

### 11. Interruptor operativo `BOOKING_ENABLED` (a pedido del usuario)
Al documentar la decisión 10 se encontró que el propio `design.md` afirmaba que `BOOKING_ENABLED=false` "sigue evitando reservas reales" - afirmación falsa: la variable se validaba pero ningún código la leía. El usuario pidió implementar el interruptor de verdad, con el default siempre en `true` (nunca bloquear por un valor ausente).

El interruptor solo aplica bajo contexto `production` (`isBookingAcceptanceEnabled()` en `confirm-pay-at-property.ts`, decidido por `createDatabaseBoundary()`), no globalmente por el valor crudo de `BOOKING_ENABLED`. Esto fue necesario porque `.env.test.example`/`scripts/with-test-env.mjs` fijan `BOOKING_ENABLED=false` como aserción de seguridad para *toda* corrida de tests automatizados (ver `tests/README.md`) - un valor que hasta ahora era decorativo. Si el interruptor hubiera aplicado también bajo `mock`, esa aserción de test habría empezado a bloquear el propio flujo de reservas mock que los tests existentes verifican, sin ninguna razón real (mock ya es un entorno aislado). Se conectó en dos capas: la API (`app/api/bookings/pay-at-property/route.ts`, rechaza con 503 antes de tocar el limitador o Postgres) y la UI (`BookingConfirmationController` oculta el botón y muestra un aviso en vez de dejarlo fallar tras el click).

**Alternativa considerada:** aplicar el interruptor también bajo `mock` y cambiar `.env.test.example` a `BOOKING_ENABLED=true` - se descarta porque ese archivo fija deliberadamente `mock` + `BOOKING_ENABLED=false` como el estado "seguro por definición" para cualquier test, y tocar esa aserción para acomodar una función productiva sería invertir la relación de causalidad correcta (la producción se adapta al contrato de test, no al revés).

## Risks / Trade-offs

- [Ejecutar migraciones contra el proyecto real es una operación difícil de revertir] → Verificar primero contra el harness de integración extendido (Decisión 2) y hacer un respaldo/snapshot antes de aplicar contra el proyecto real.
- [El Session pooler puede no ser accesible desde el entorno donde se ejecute la migración] → Si falla, usar la conexión directa del proyecto (IPv6) como alternativa, documentando cuál se usó.
- [Cargar contenido real antes de que esté aprobado en su totalidad podría publicar datos incorrectos] → El script de carga de contenido se ejecuta bajo revisión explícita del usuario antes de cada corrida, y las habitaciones seguirán `active=false` hasta que el contenido esté aprobado (mismo mecanismo ya usado por los fixtures de demostración).
- [A pedido del usuario, `.env.local` quedó en `VISTA_VALLE_CONFIG_CONTEXT=production` de forma persistente en desarrollo local, con Mercado Pago/IA/Resend en valores `unset-*` (no mock, pero tampoco reales) solo para no bloquear el arranque] → Si en algún punto se intenta usar de verdad pago online, IA o envío de correo sin haber reemplazado esos valores, fallará en tiempo de ejecución en vez de al arrancar. Reemplazar cada `unset-*` por su credencial real apenas esté disponible.
- [RESUELTO por la decisión 11: `BOOKING_ENABLED` ya bloquea reservas reales de verdad (antes se validaba pero no se leía). Ver decisión 11 para el alcance exacto (solo aplica bajo `production`)] → Ninguna acción pendiente por este ítem específico; sigue faltando lo demás de la tarea 10.4 original del MVP (procedimiento de rollback, recuperación del outbox), fuera del alcance de este cambio.

## Migration Plan

1. Agregar el índice sobre `reservations(check_in, check_out)` al esquema y generar su migración.
2. Cablear `drizzle.config.ts` y agregar `db:migrate`, sin tocar el comportamiento de `db:generate`/`db:check`.
3. Extender `scripts/run-postgres-integration.mjs` para reproducir todas las migraciones y confirmar que la suite de integración sigue pasando.
4. Ejecutar `db:migrate` una vez contra el proyecto Supabase real usando el Session pooler.
5. Aplicar `supabase/rls/operational-tables.sql` y `supabase/storage/room-images.sql` contra el proyecto real.
6. Crear el usuario administrador real en Supabase Auth (`vistavallespa@gmail.com`) y configurar `ADMIN_ALLOWED_EMAILS`.
7. Cargar el contenido real de las tres habitaciones (datos + fotografías) mediante el script de carga.
8. Verificar manualmente: conexión productiva, login del administrador, y que el catálogo lea las habitaciones reales bajo un contexto de verificación explícito, sin activar `BOOKING_ENABLED` ni cambiar el contexto de despliegue.

## Variables de entorno productivas para Vercel

Esta lista es la referencia para configurar el entorno de producción en Vercel al desplegar (no se configura como parte de este cambio). Estado a la fecha de este cambio:

**Ya resueltas por este cambio (proyecto Supabase real `ljwukpcwysvahqmrpwjd`):**
- `VISTA_VALLE_CONFIG_CONTEXT=production`
- `NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT=production`
- `NEXT_PUBLIC_SUPABASE_URL` — URL real, ya en `.env.local`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — ya en `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` — ya en `.env.local`; en Vercel solo debe vivir como variable de entorno del servidor, nunca expuesta al cliente
- `DATABASE_URL` — Transaction pooler (6543), ya en `.env.local`; usar exactamente ese valor en Vercel, no el Session pooler usado para migrar
- `ADMIN_ALLOWED_EMAILS=vistavallespa@gmail.com` — ya en `.env.local`

**Pendientes de gestión aparte (fuera del alcance de este cambio, según lo indicado por el usuario):**
- `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`
- `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`
- `RESEND_API_KEY`, `RESEND_DELIVERY_MODE`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`
- `SITE_URL` (depende del dominio final)

**Sin cambios respecto a `.env.example` (no dependen de Supabase):**
- `TIMEZONE`, `BOOKING_HOLD_DURATION_MINUTES`, `ASSISTANT_PROPOSAL_TTL_MINUTES`, `NOTIFICATION_MAX_RETRIES`
- `BOOKING_ENABLED=false` — debe permanecer así hasta la conciliación y aprobación final (tareas 10.3–10.5 del MVP), no se activa como parte de este cambio

**Acción manual pendiente, no resuelta por este cambio:** deshabilitar "Allow new users to sign up" en el dashboard de Supabase (Authentication → Providers → Email) — no hay CLI ni Management API disponible en este entorno para hacerlo remotamente.

Rollback: dado que el proyecto Supabase se crea vacío, cualquier paso puede revertirse recreando el proyecto o revirtiendo el esquema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) y reaplicando desde el paso 4, sin impacto en otros sistemas.
