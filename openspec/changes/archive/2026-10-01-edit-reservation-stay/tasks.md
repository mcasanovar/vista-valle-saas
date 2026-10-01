> **Orden de ejecución.** Las secciones 1 a 4 llevan el dominio y la persistencia al modelo de estadía dejando
> el eje fechas funcionando sobre el camino nuevo; recién la sección 6 reemplaza la interfaz. Esto mantiene la
> suite del eje fechas como red de seguridad durante todo el trabajo de dominio, tal como pide el plan de
> despliegue de `design.md`.

> **Estado de las tareas 1.2 a 1.4.** Verificadas contra Postgres real (Postgres.app 18, base
> `vista_valle_integration_test`): las 13 pruebas de `tests/postgres-edit-reservation-dates.integration.test.ts`
> pasan, incluidas las 6 del diff de tres vías. El archivo **no estaba en la lista de
> `scripts/run-postgres-integration.mjs`**, así que nunca se había ejecutado; se agregó. Incorporarlo destapó
> una colisión de identificadores de habitación con `postgres-operational-alerts`, `postgres-room-images` y
> `postgres-admin-pending-payments`, porque el runner comparte una sola base sin aislamiento por archivo: este
> archivo pasó a un rango exclusivo (`…001001`–`…001091`). Quedan fuera del runner otros cinco archivos de
> integración preexistentes (`admin-calendar`, `admin-dashboard-summary`, `room-images`,
> `room-occupancy-pricing`, `manual-reservation-action`), que este cambio no toca.

## 1. Diff de ítems en la persistencia

- [x] 1.1 Ampliar el contrato de escritura de la estadía en el repositorio de reservas (`src/infrastructure/database/reservation-repository.ts:299-315`) para que reciba el conjunto completo de ítems solicitados en vez de asumir que cada uno ya existe; verificar con `npm run typecheck` y con la suite existente del eje fechas en verde.
- [x] 1.2 Implementar el diff de tres vías dentro de la transacción existente, aplicando `DELETE` de los ítems que salen, `UPDATE` de los que permanecen e `INSERT` de los que entran, en ese orden; verificar con pruebas de repositorio que cubran los cuatro casos por separado: intercambio A→B, agregar, quitar y cambio de solo ocupación.
- [x] 1.3 Agregar una prueba que confirme que el intercambio no viola `reservation_items_reservation_room_unique`, quitando una habitación y volviéndola a agregar para que el `INSERT` reutilice el par `(reservationId, roomId)` que el borrado liberó. **Corrección sobre el plan original:** se pedía "verificar que la prueba falla si se invierte el orden de las operaciones", y eso resultó imposible porque la premisa era falsa: los tres grupos del diff son disjuntos por construcción, así que el orden no puede violar el índice. Se comprobó invirtiendo el orden en el adapter y corriendo las pruebas de integración, que siguieron pasando; `design.md` quedó corregido.
- [x] 1.4 Agregar una prueba de integración Postgres en `tests/postgres-edit-reservation-dates.integration.test.ts` (o su sucesora de estadía) que verifique que al quitar una habitación se elimina su fila de `reservation_items` con su `charges_clp` y no queda ninguna fila huérfana.

## 2. Caso de uso de estadía

- [x] 2.1 Crear `editReservationStay` en `src/features/reservations/` a partir de `edit-reservation-dates.ts`, con `interval` e `items` ambos opcionales que por omisión toman los valores actuales de la reserva; verificar con `npm run typecheck` y con una prueba que confirme que omitir ambos deja la reserva sin cambios de valor.
- [x] 2.2 Recalcular el precio de la estadía resultante resolviendo la tarifa por ocupación de cada habitación con la lógica ya existente de `toResolvedRoom` (`src/features/reservations/room-selection.ts:49`); verificar con una prueba que cambiar solo la cantidad de personas de una habitación, sin mover fechas, cambia su subtotal y el total agregado.
- [x] 2.3 Validar la capacidad de cada habitación solicitada reutilizando el criterio de `selectedRooms` (`room-selection.ts:23`); verificar con una prueba que una ocupación mayor que la capacidad se rechaza como resultado tipado y la reserva queda intacta.
- [x] 2.4 Rechazar la estadía sin habitaciones con una validación explícita **antes** de invocar `computeMultiRoomReservationPricing`, devolviendo un resultado tipado con mensaje propio; verificar con una prueba que quitar la última habitación devuelve ese resultado y no propaga `InvalidPricingInputError`.
- [x] 2.5 Tomar el bloqueo con `runExclusiveMany` sobre la **unión** de habitaciones actuales y solicitadas, pasando `excludeReservationId`, y dejar un comentario que explique por qué el chequeo de la habitación saliente es un no-op deliberado (con la traza del ciclo de vida de los holds registrada en `design.md`); verificar con una prueba que agregar una habitación ocupada por otra reserva confirmada se rechaza, y que quitar una habitación no se rechaza por sí misma.
- [x] 2.6 Reutilizar `computeReservationDateEditFinancialSummary` sin modificarlo para el resumen financiero de la estadía; verificar con pruebas los tres casos ya especificados —sin pagos, con saldo adicional y con sobrepago— más el sobrepago alcanzado por quitar una habitación.
- [x] 2.7 Conservar la elegibilidad de cualquier origen y cualquier estado; verificar con una prueba que editar la estadía de una reserva cancelada, completada o no presentada no altera su estado.
- [x] 2.8 Reescribir `editReservationDates` como delegación a `editReservationStay` con `items` igual a los ítems actuales, o retirarlo si ya no tiene consumidores; verificar que `tests/edit-reservation-dates.test.ts` pasa sin cambios de expectativa.

## 3. Disponibilidad para la edición

- [x] 3.1 Agregar una consulta de disponibilidad de edición que **no** aplique `validateManualReservationDateRange` y que reciba `excludeReservationId`, junto a `src/features/admin/manual-reservation-availability.ts` pero como función separada; verificar con una prueba que devuelve habitaciones para un intervalo cuyo `check-in` ya pasó.
- [x] 3.2 Verificar con una prueba que las habitaciones que la propia reserva ocupa se reportan como disponibles y seleccionadas, no como ocupadas por un tercero.
- [x] 3.3 Verificar con una prueba que la nueva consulta no es alcanzable desde el flujo público de disponibilidad y que la regla de fecha mínima pública sigue aplicándose ahí sin cambios.

## 4. Auditoría y notificación

- [x] 4.1 Ampliar el contenido del evento de auditoría del cambio para incluir habitaciones entrantes y salientes y la cantidad de personas anterior y nueva por habitación, además de los campos de fechas y financieros que ya registra; verificar con una prueba que un intercambio de habitación con cambio de ocupación deja un único evento con los tres ejes.
- [x] 4.2 Ampliar la plantilla del correo administrativo para que describa el cambio de estadía completo; verificar con una prueba del renderizador que un cambio de solo habitaciones produce un correo que identifica las que entran y las que salen.
- [x] 4.3 Verificar con una prueba que el cambio de estadía encola exactamente una notificación, dirigida al destinatario administrativo, y ninguna al huésped.
- [x] 4.4 Verificar con una prueba que una modificación rechazada —por capacidad, disponibilidad o estadía vacía— no escribe auditoría de éxito ni encola notificación.

## 5. Server Action

- [x] 5.1 Convertir `src/features/admin/edit-reservation-dates-action.ts` en la acción de estadía, aceptando fechas, conjunto de habitaciones y ocupación en un mismo `FormData` con el codec de `room-selection-codec.ts`; verificar con `tests/edit-reservation-dates-action.test.ts` adaptado que la acción sigue verificando al administrador y devolviendo resultado tipado sin lanzar nunca.
- [x] 5.2 Verificar con una prueba que la acción no acepta precios, capacidades ni totales enviados por el cliente, y que ignora cualquier campo de ese tipo presente en el `FormData`.

## 6. Interfaz del detalle de reserva

- [x] 6.1 Reemplazar `src/features/admin/edit-reservation-dates-form.tsx` por el formulario de estadía, sumando la lista de habitaciones con checkbox e input de huéspedes con clamp a capacidad tomada de `manual-reservation-form.tsx:375-425`; verificar con `tests/edit-reservation-dates-form.test.tsx` adaptado que un submit envía fechas, habitaciones y ocupación juntos.
- [x] 6.2 Actualizar `app/(admin-protected)/admin/reservas/[id]/page.tsx` para alimentar el formulario con la disponibilidad de edición de la sección 3 y las habitaciones actuales preseleccionadas con su ocupación; verificar en el detalle de una reserva real de desarrollo que el formulario abre con el estado correcto.
- [x] 6.3 Mostrar el resultado financiero recalculado, el saldo pendiente y el sobrepago en la respuesta del formulario, como ya hace el eje fechas; verificar con una prueba del formulario que un cambio que reduce el total por debajo de lo pagado muestra el sobrepago.
- [x] 6.4 Verificar con una prueba que quitar todas las habitaciones en la interfaz muestra el mensaje de "al menos una habitación" y no envía la operación, o la envía y muestra el rechazo, sin dejar la reserva modificada.

## 7. Advertencia de sincronización de canales

- [x] 7.1 Extender la advertencia de sincronización manual del formulario para que cubra el cambio de habitaciones, no solo el de fechas; verificar con una prueba del formulario que un cambio que agrega o intercambia habitaciones muestra la advertencia antes de confirmar.
- [x] 7.2 Identificar en la advertencia toda habitación de la estadía resultante que no tenga una conexión de canal activa, consultando `channel_connections`; verificar con una prueba que una habitación entrante sin conexión activa aparece nombrada en la advertencia y que un intercambio entre habitaciones conectadas no nombra ninguna.

> **Resultado de la verificación (tarea 8.2).** `npm run typecheck` y `npm run lint` limpios. Suite unitaria:
> 880 pruebas pasan y 1 falla, `tests/prebooking-review-controller.test.tsx`, que ya fallaba antes de este
> cambio (verificado aislando el árbol con `git stash`). `npm run test:quality` deja 3 pruebas e2e de
> accesibilidad del sitio público en rojo, también preexistentes y ajenas al panel administrativo. Del formato
> del repositorio solo se tocaron los archivos nuevos de este cambio: los modificados ya estaban fuera de
> Prettier antes (264 archivos en total), y reformatearlos habría ensuciado el diff.

## 8. Cierre del cambio

- [x] 8.1 Reescribir el `## Purpose` de `openspec/specs/reservation-date-editing/spec.md` para que describa la edición de estadía completa en vez de solo las fechas, ya que un delta de capability existente no puede cambiarlo; verificar que el texto resultante no menciona las fechas como único eje.
- [x] 8.2 Ejecutar `npm run typecheck`, la suite completa de pruebas y la verificación de calidad del proyecto; verificar que no queda ninguna referencia a `editReservationDates` ni a `EditReservationDatesForm` que no sea la delegación deliberada de la tarea 2.8.
- [x] 8.3 Ejecutar `openspec validate edit-reservation-stay --strict` y confirmar que el cambio sigue válido antes de archivarlo.
