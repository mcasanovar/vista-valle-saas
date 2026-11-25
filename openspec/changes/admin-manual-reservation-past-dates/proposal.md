## Why

El formulario de reserva manual del panel administrativo reutiliza la regla de fechas del sitio público: la entrada no puede ser anterior a hoy y la salida no puede ser anterior a mañana (`manualReservationDateMinimums` en `src/features/admin/manual-reservation-contract.ts` delega en `publicAvailabilityDateMinimums`). Esa regla existe para que un visitante no pueda consultar disponibilidad en fechas que ya pasaron, y ahí sigue teniendo sentido.

En la operación real no lo tiene. Las reservas de canales externos y de WhatsApp llegan tarde: una estadía que empezó ayer, un huésped que ya está en la habitación, una reserva de Airbnb que nadie alcanzó a registrar. Hoy el administrador no puede registrarla —el control de fecha ni siquiera ofrece el día anterior— y termina creando la reserva con una fecha de entrada falsa, lo que corrompe el calendario, la ocupación y los ingresos del período.

El mismo razonamiento ya se aplicó una vez en este proyecto: la edición de estadía de una reserva existente deliberadamente **no** aplica la regla de mínimos, y `src/features/admin/stay-edit-availability.ts` lo documenta. Este cambio extiende ese criterio a la creación.

## What Changes

- El flujo administrativo de creación de reserva manual acepta fechas de entrada y de salida anteriores a hoy, sin ventana máxima hacia atrás: tanto una estadía en curso (entrada pasada, salida futura) como una estadía ya terminada por completo.
- La única regla de fechas que queda en el flujo administrativo es la invariante del dominio: la salida SHALL ser posterior a la entrada. Se aplica en el formulario, en el BFF de disponibilidad y al confirmar.
- La validación de disponibilidad no cambia: una estadía pasada sigue compitiendo por la habitación contra reservas confirmadas, holds vigentes y bloqueos, y sigue revalidándose dentro del lock al confirmar.
- El sitio público **no cambia**. La regla de fechas vigentes del buscador público vive en `src/features/availability/search.ts` y `src/features/availability/results-query.ts`, que no dependen del contrato administrativo.
- El asistente administrativo hereda la relajación, porque su propuesta `crear_reserva` ejecuta la misma función de dominio que la pantalla de creación manual. Eso es deseado: es el mismo administrador por otra vía.

## Capabilities

### New Capabilities

Ninguna. El comportamiento pertenece a una capacidad existente.

### Modified Capabilities

- `admin-manual-reservations`: se agrega el requisito «Registro de estadías ya iniciadas o pasadas», que fija explícitamente que la creación administrativa no aplica la regla de fechas vigentes del sitio público y que la única restricción es que la salida sea posterior a la entrada. El requisito «Reserva administrativa multi-habitación» se precisa para no dejar «fechas válidas» ambiguo frente a esta nueva libertad.

## Impact

**Código afectado**

- `src/features/admin/manual-reservation-contract.ts`: deja de derivar sus mínimos de `publicAvailabilityDateMinimums`; su validación pasa a verificar únicamente el orden del intervalo.
- `src/features/admin/manual-reservation-form.tsx`: el control de entrada pierde su `min`; el de salida toma como `min` la entrada elegida, como guía de interfaz.
- `src/features/admin/manual-reservation-availability.ts` y `src/features/admin/manual-reservation.ts`: mantienen la validación autoritativa, ahora con la regla reducida.

**Sin cambios**

- Buscador y disponibilidad pública, esquema de base de datos (la única restricción es `reservations_check_out_after_check_in`), lógica de solapamiento y lock por habitación, precios por ocupación, notificaciones.
