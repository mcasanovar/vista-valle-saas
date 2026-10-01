## Context

Ver `proposal.md` — Why para la motivación. Los requisitos de comportamiento están en los dos deltas de `specs/`; este documento no los repite.

El estado actual relevante para el enfoque:

- El eje fechas ya existe completo y en producción: un formulario cliente envía `FormData` a una Server Action que verifica al administrador y devuelve un resultado tipado sin lanzar; la acción delega en un caso de uso de `src/features/reservations/` que valida elegibilidad, parsea el intervalo, recalcula la tarifa **vigente**, calcula el resumen financiero y corre todo dentro de `roomLockGateway.runExclusiveMany(roomIds, interval, op, { excludeReservationId })`, que abre una sola transacción donde se escriben ítems, pagos y auditoría y se encola la notificación.
- `computeReservationDateEditFinancialSummary` es **agnóstico al eje**: solo mira el total nuevo, los pagos aprobados y si queda pendiente. No hay que tocarlo para soportar habitaciones.
- El `guestCount` del encabezado de la reserva se **deriva** de la suma de sus ítems (`reservation-repository.ts:63`), así que no hay denormalización que mantener al cambiar la ocupación.
- Los cargos viven denormalizados como `charges_clp` dentro de `reservation_items` (`persistence/schema.ts:289`), no en una tabla aparte: borrar el ítem se lleva su cargo y no deja filas huérfanas.
- El lado de creación manual ya tiene las piezas del eje habitación: `selectedRooms` (`room-selection.ts:23`) parsea `"roomA:2,roomB:3"` y descarta lo que exceda la capacidad; `toResolvedRoom` (`:49`) resuelve el precio noche por ocupación; y el control de checkbox más input de huéspedes con clamp a capacidad existe en `manual-reservation-form.tsx:375-425`.
- `computeMultiRoomReservationPricing` **lanza** `InvalidPricingInputError("At least one room is required")` (`pricing.ts:78`) si la selección queda vacía.
- `listOccupyingIntervals` solo considera reservas con `status = 'confirmed'` (`room-lock.ts:83`).

## Goals / Non-Goals

**Goals:**

- Un único lugar en el dominio donde vivan el recálculo de la estadía y el diff de ítems, para que el eje fechas y el eje habitaciones no puedan divergir con el tiempo.
- Que el adapter de persistencia soporte un cambio de conjunto de ítems, no solo una actualización en sitio.
- Que la edición funcione sobre una reserva **ya en curso**, que es el caso que motiva el cambio.
- Que agregar una habitación sea seguro frente a concurrencia sin duplicar la lógica de disponibilidad fuera del gateway de bloqueo.

**Non-Goals:**

- No se introduce ninguna dependencia nueva, ni de UI ni de infraestructura.
- No se cambia la conciliación de pagos ya especificada para el eje fechas: la resolución de un sobrepago sigue siendo manual.
- No se toca el flujo público de reservas, ni el cálculo de disponibilidad público, ni sus reglas de fecha mínima.
- No se implementa propagación automática hacia Airbnb o Booking. El feed iCal saliente se deriva de la ocupación y refleja el cambio por sí solo; el bloqueo en el otro sentido sigue siendo manual y solo se advierte.
- No se renombra el directorio de la capability `reservation-date-editing`.

## Decisions

### Un caso de uso único de estadía, que el eje fechas pasa a usar

`editReservationStay({ reservationId, interval?, items? })` reemplaza a `editReservationDates` como único punto del dominio que modifica una estadía. Cuando el llamador omite `items`, se entienden los ítems actuales de la reserva; cuando omite `interval`, se entiende el intervalo actual. El eje fechas deja de tener implementación propia.

*Por qué*: el usuario eligió una sola operación de estadía en la interfaz, y sostener dos casos de uso con el mismo recálculo garantiza que en unos meses uno de los dos tenga un arreglo que el otro no. Un solo camino significa una sola auditoría, un solo evento de notificación y un solo resumen financiero, que es exactamente lo que se pidió.

*Alternativa considerada*: un `editReservationRooms` nuevo e independiente junto al de fechas. Descartada porque duplica el recálculo y obliga al administrador que mueve fecha y habitación a hacer dos ediciones, con dos correos y dos registros de auditoría.

### El diff de ítems se resuelve en tres vías

El adapter hoy itera los ítems recibidos y hace `UPDATE ... WHERE reservationId AND roomId` (`reservation-repository.ts:299-315`). Pasa a calcular tres conjuntos y aplicarlos en este orden dentro de la transacción ya existente:

```
items actuales {A:2, B:3}  →  solicitados {B:2, C:4}

  1. DELETE   A        (sale; libera disponibilidad y se lleva su charges_clp)
  2. UPDATE   B  3→2   (permanece; la tarifa por ocupación cambia)
  3. INSERT   C  :4    (entra; su disponibilidad ya fue verificada por el lock)
```

*Sobre el orden*: se conserva borrar → actualizar → insertar por legibilidad, porque es el orden en que se razonan los conjuntos, **no** por una necesidad del índice único. La primera versión de este diseño afirmaba lo contrario; al verificarlo contra Postgres resultó falso y se corrigió aquí. Los tres grupos son disjuntos por construcción —las salientes son filas persistidas ausentes de la petición, y las entrantes son habitaciones pedidas que todavía no tienen fila—, de modo que un `INSERT` nunca puede chocar contra una fila que este mismo diff va a borrar bajo `uniqueIndex("reservation_items_reservation_room_unique")`. Invertir el orden en el adapter y correr las pruebas de integración lo confirma: siguen pasando.

*Nota*: las referencias de `reservation_items` a `reservations` y `rooms` son `onDelete: "restrict"`, lo que restringe el borrado del padre, no el del ítem. El `DELETE` del ítem no está bloqueado por eso.

### El bloqueo se toma sobre la unión, y el chequeo de la habitación saliente es un no-op deliberado

Se llama `runExclusiveMany(actuales ∪ solicitadas, intervalo, op, { excludeReservationId })`. El gateway verifica disponibilidad de **todas** las habitaciones que recibe, incluida la que se va a liberar.

Eso no produce un rechazo incorrecto: en ese intervalo la habitación saliente solo está ocupada por esta misma reserva, y `excludeReservationId` la descarta del cálculo de solapamiento. El chequeo se ejecuta y no encuentra nada. Se deja constancia en un comentario en el código para que nadie lo "arregle" más adelante creyendo que sobra.

*Verificado*: `excludeReservationId` filtra únicamente entradas con `source === "reservation"` (`room-lock.ts:194-196`), de modo que un hold vivo sobre la habitación **no** quedaría excluido. Se trazó el ciclo de vida de los holds y no hay rechazo incorrecto posible por esa vía: `deleteHold` se invoca al confirmar en `confirm-pay-now-reservation.ts:101,131`, y `confirm-pay-at-property.ts` no crea holds. Ninguna reserva confirmada conserva un hold vivo propio. Si en el futuro algún flujo dejara holds vivos tras confirmar, este filtro tendría que cubrir también `source === "hold"`.

*Alternativa considerada*: `runLockedMany(unión)` tomando solo los locks y chequeando disponibilidad exclusivamente de las habitaciones entrantes. Descartada porque obliga a reimplementar la consulta de solapamiento fuera del gateway, que es hoy la única definición de disponibilidad compartida con el repositorio de búsqueda.

### Un BFF de disponibilidad propio para la edición, no el de creación manual

El formulario necesita saber qué habitaciones puede ofrecer. `getManualReservationAvailability` no sirve: aplica `validateManualReservationDateRange`, la regla pública de "entrada no antes de hoy". El caso que motiva este cambio es justamente una reserva **en curso**, cuyo `check-in` ya pasó, y `parseRequestedEditInterval` documenta explícitamente lo contrario ("no minimum-date rule is applied here: an active reservation may keep a past check-in").

Se agrega una consulta de disponibilidad de edición que no aplica regla de fecha mínima y que recibe `excludeReservationId`, para que las habitaciones que la propia reserva ya ocupa aparezcan como seleccionables y no como ocupadas por un tercero.

*Alternativa considerada*: parametrizar el BFF de creación manual con una bandera que desactive la regla de fecha mínima. Descartada porque una bandera que relaja una regla pública es fácil de encender por error desde el flujo público; una función separada no es alcanzable desde ahí.

### La estadía vacía se rechaza antes de llegar al cálculo de precio

`computeMultiRoomReservationPricing` lanza cuando la selección está vacía (`pricing.ts:78`). Como la Server Action del panel devuelve un resultado tipado y nunca lanza, quitar la última habitación debe rechazarse con una validación explícita **antes** de invocar el cálculo, para que el administrador reciba un mensaje que explique el motivo en lugar de un error inesperado. La guardia de `pricing.ts` se conserva como red de seguridad del dominio, no como el mecanismo de mensaje al usuario.

### El formulario de fechas se reemplaza, no se conserva junto al nuevo

El formulario de edición de fechas del detalle de reserva y su Server Action se convierten en el formulario y la acción de estadía: mismo lugar en la interfaz, mismos controles de fecha, más la lista de habitaciones con checkbox e input de huéspedes que ya existe en creación manual. No queda un segundo formulario "solo fechas".

*Por qué*: es la decisión que el usuario tomó explícitamente. Mantener los dos formularios reintroduciría los dos recálculos y los dos correos que el cambio busca eliminar.

*Costo asumido*: se reemplaza interfaz que hoy funciona en producción, por lo que la cobertura de pruebas del eje fechas debe seguir verde sobre el camino nuevo antes de desplegar.

### La capability conserva su nombre de directorio

El delta se escribe sobre `reservation-date-editing` aunque su alcance ya no sea solo fechas, y dentro del delta se renombra el requisito principal a "Edición transaccional de la estadía".

*Por qué*: renombrar el directorio de una capability no es una operación que el flujo de deltas y archivado exprese, y arriesgar el historial de archivado para corregir un nombre no vale la pena. El `Purpose` del spec principal sí se reescribe al alcance real, como tarea explícita, porque un delta de capability existente no puede cambiarlo.

### Elegibilidad de cualquier estado, con su consecuencia registrada

La edición sigue admitiendo cualquier origen y cualquier estado, igual que el eje fechas. El usuario tomó esta decisión conociendo su consecuencia: como `listOccupyingIntervals` solo considera reservas `confirmed`, editar la estadía de una reserva **cancelada** pasa el chequeo de disponibilidad de forma trivial, y podría asignarle una habitación que otra reserva confirmada ocupa. No genera un doble booking real porque la reserva cancelada no ocupa nada, pero deja un registro histórico que se superpone con otro. Se acepta por coherencia con el eje fechas.

## Risks / Trade-offs

- **Se reimplementa sobre el camino nuevo una operación que hoy funciona en producción** → La suite existente del eje fechas se conserva sin cambios de expectativa y debe pasar contra `editReservationStay` antes de tocar la interfaz; el trabajo se ordena para que el dominio y la persistencia estén verdes antes de reemplazar el formulario.
- **El diff de tres vías es la parte con más casos límite** (intercambio, agregar, quitar, cambio de solo ocupación, y la combinación de todo con un cambio de fechas) → Cada caso entra como prueba del repositorio antes de existir en la interfaz, incluido el intercambio que valida el orden borrar-antes-de-insertar contra el índice único.
- **Quitar una habitación puede dejar el total por debajo de lo ya pagado** → El comportamiento ya está especificado para el eje fechas —conservar los pagos, dejar constancia del sobrepago, no cobrar— y se reutiliza tal cual; el escenario entra como prueba propia porque ahora se alcanza por una vía nueva.
- **Una habitación sin conexión de canal activa cambia de forma silenciosa el comportamiento de sincronización** → Se advierte en la interfaz antes de confirmar, identificando la habitación. Es una mitigación de visibilidad, no una solución: la propagación hacia los canales externos sigue siendo manual.
- **Editar una reserva cancelada no valida disponibilidad de verdad** → Aceptado explícitamente; queda registrado arriba y en el delta de spec para que no se lea como una omisión.

## Migration Plan

- **Sin migración de datos y sin cambio de esquema.** Los cargos ya viven en el ítem y el `guestCount` del encabezado se deriva de los ítems.
- **Orden de despliegue**: dominio y persistencia primero, con el eje fechas delegando en el caso de uso nuevo y la suite existente verde; el reemplazo del formulario va después, en el mismo cambio pero como paso posterior en las tareas.
- **Rollback**: revertir el despliegue. No queda estado nuevo que deshacer — las reservas editadas con la operación de estadía quedan en un estado que la versión anterior sabe leer, porque las tablas no cambian. Lo único que la versión anterior no podría es *volver a producir* un cambio de habitaciones.
