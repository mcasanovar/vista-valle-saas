## Context

Ver `proposal.md - Why` para la motivación. Dos mecanismos existentes son relevantes para el diseño:

- `assertReservationDatesEditable()` (`src/features/reservations/edit-reservation-dates.ts`) es el único punto de verdad que decide si una reserva puede editar fechas, compartido entre el gate de UI (`canEditDates` en `app/(admin-protected)/admin/reservas/[id]/page.tsx`) y la validación del servidor dentro de la transacción.
- Cada conexión de sincronización (`channel_connections`, `roomId` + `platform` únicos) ya tiene un campo `enabled` individual, pero no existe ningún control a nivel de plataforma, y `setChannelConnectionEnabledAction` no está conectada a ninguna UI.

## Goals / Non-Goals

**Goals:**
- Un único punto de verdad para "esta reserva puede editar fechas" que ahora siempre sea verdadero, sin duplicar la comprobación en cliente y servidor.
- Un estado de pausa por plataforma que sobreviva independientemente del `enabled` por conexión, para poder reactivarlo sin reconfigurar nada.
- Una ruta de edición de datos de contacto del huésped separada de la edición de fechas, porque no comparten efectos secundarios (recálculo financiero vs. ningún efecto).

**Non-Goals:**
- No se implementa la integración futura más detallada con Airbnb/Booking mencionada por el usuario; este change solo pausa la integración actual.
- No se agrega auditoría de cambios para la edición de datos de contacto del huésped (el usuario decidió que sea editable sin excepciones y no pidió trazabilidad); si se quisiera, podría reutilizarse el mismo patrón de auditoría que ya existe para edición de fechas.
- No se cambia el comportamiento de ingesta/publicación en sí (parser, formato iCal, alertas de conflicto) — solo se agrega la puerta de pausa antes de ejecutarlas.

## Decisions

### 1. Eliminar el origin-gate en `assertReservationDatesEditable()` en vez de rodearlo

Se simplifica la función para que ya no lance `ReservationDateEditIneligibleError` por origen (se elimina `EDITABLE_RESERVATION_ORIGINS` como lista de bloqueo). Se mantiene la función como punto único de verdad —aunque ahora sea un no-op— en vez de eliminarla y quitar la llamada en cliente/servidor, para conservar el mismo patrón si en el futuro se necesita otra regla de elegibilidad (por ejemplo, ligada a la nueva integración futura).

**Alternativa descartada**: eliminar la función y el gate por completo del cliente/servidor. Se descarta porque perdería el único punto de enforcement compartido, obligando a mantener la lógica de UI y servidor sincronizada a mano.

### 2. Estado de pausa por plataforma como una capa independiente, no un toggle masivo de `enabled`

Se agrega un estado nuevo, `channel_platform_sync_paused` (por ejemplo una fila de configuración con `platform` + `paused: boolean`, o una tabla `channel_platform_pause` con esas dos columnas), en vez de poner `enabled = false` en todas las conexiones de esa plataforma.

**Por qué**: si el toggle apagara `enabled` en cada conexión, reactivar la plataforma requeriría saber cuáles conexiones estaban `enabled` antes de la pausa para no reactivar una que el admin había desactivado a propósito por otro motivo. Guardar el estado de pausa aparte evita ese problema: `enabled` por conexión sigue significando exactamente lo que significaba antes.

**Alternativa descartada**: reutilizar `enabled` con un flag adicional `pausedByPlatformToggle` en cada fila para poder revertir. Se descarta por ser más compleja (hay que migrar cada fila) que un único registro de pausa por plataforma.

### 3. Puntos de enforcement de la pausa

- **Entrante**: `pollAllActiveConnections()` (`src/features/channel-calendar-sync/poll.ts`) consulta el estado de pausa por plataforma antes de procesar las conexiones de esa plataforma, y omite (skip, no error) las conexiones cuya plataforma esté pausada — igual que ya hace con conexiones individualmente no `enabled`.
- **Saliente**: `app/api/ical/[token]/route.ts` resuelve la conexión por token, obtiene su `platform`, y si esa plataforma está pausada responde sin exponer datos de ocupación (mismo código de respuesta que "token no encontrado", para no filtrar si el token es válido o no).

### 4. Edición de datos de contacto del huésped como acción separada

Nueva server action (por ejemplo `updateReservationGuestContactAction`) que solo toca nombre, apellido, correo y teléfono del huésped, con su propia validación de formato, sin pasar por `editReservationDates` ni su recálculo financiero. La UI agrega un formulario editable en la sección de datos del huésped del detalle de reserva (hoy son `<dd>` de solo lectura), visible siempre, sin condicionar su render al origen o estado de la reserva.

**Alternativa descartada**: extender `editReservationDates`/`EditReservationDatesTransactionInput` para que también acepte campos de huésped. Se descarta porque mezclaría dos operaciones con efectos colaterales muy distintos (una recalcula precios y pagos, la otra no debería tocar nada de eso), complicando el manejo de errores parciales.

### 5. UI de los dos interruptores

En `app/(admin-protected)/admin/sincronizaciones/page.tsx`, dos controles (uno por plataforma) que llaman a una nueva acción de pausa/reanudación por plataforma, mostrando el estado actual y, cuando está pausado, un aviso de que las conexiones de esa plataforma no reciben ni envían datos hasta reactivarla.

## Risks / Trade-offs

- **[Riesgo] Desincronización silenciosa con la OTA** → si la plataforma no está pausada y se edita localmente una reserva de origen Airbnb/Booking, ese cambio nunca se escribe de vuelta hacia la plataforma externa. Mitigación: mostrar un aviso en el detalle de la reserva cuando su origen es Airbnb/Booking, recordando que conviene pausar esa plataforma antes de editar fechas si se quiere evitar la divergencia. Esto es una advertencia de UI, no un bloqueo.
- **[Riesgo] Sobreventa mientras una plataforma está pausada** → al dejar de responder el feed saliente, Airbnb/Booking pueden no saber qué fechas están ocupadas y aceptar una reserva que choque con una ya existente localmente. Mitigación: es un trade-off aceptado explícitamente en el proposal (marcado **BREAKING** temporal); el admin es responsable de bloquear manualmente las fechas críticas en la plataforma externa mientras dure la pausa.
- **[Riesgo] Sin auditoría de la edición de contacto del huésped** → no queda registro de quién cambió el correo/teléfono de un huésped. Mitigación: aceptado por decisión explícita del usuario; se puede añadir después reutilizando el patrón de auditoría existente para fechas, sin cambiar esta spec.

## Migration Plan

1. Agregar el almacenamiento del estado de pausa por plataforma (migración de base de datos si se modela como tabla/fila nueva).
2. Conectar la comprobación de pausa en el poll entrante y en el feed saliente; por defecto ambas plataformas quedan "no pausadas" (comportamiento actual sin cambios) hasta que un admin las pause explícitamente.
3. Quitar el origin-gate de `assertReservationDatesEditable()` y de `canEditDates` en la UI.
4. Agregar la acción y el formulario de edición de datos de contacto del huésped.
5. Agregar los dos interruptores en `/admin/sincronizaciones`.

**Rollback**: cada pieza es independiente y reversible sin pérdida de datos — el estado de pausa por plataforma puede ignorarse (revertir el código de enforcement) sin perder la configuración `enabled` por conexión; el origin-gate puede reintroducirse revirtiendo el cambio en `assertReservationDatesEditable()`; la edición de contacto es aditiva y puede deshabilitarse ocultando el formulario sin afectar datos existentes.
