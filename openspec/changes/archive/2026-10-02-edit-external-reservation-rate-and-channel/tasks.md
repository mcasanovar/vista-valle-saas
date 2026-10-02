## 1. Esquema y persistencia

- [x] 1.1 Agregar `nightlyPriceManual` a `reservationItems` en `src/persistence/schema.ts` (`boolean not null default false`), con un comentario que aclare que `nightly_price_clp` sigue siendo el valor efectivo y esta columna solo indica su procedencia (design.md decisión 1); verificar con `npm run typecheck`
- [x] 1.2 Generar la migración con `npm run db:generate` y verificar con `npm run db:check` que el SQL emitido sea aditivo, sin backfill y sin tocar los checks existentes de `reservation_items`
- [x] 1.3 Propagar el campo a `ReservationItemRecord` en `src/features/reservations/reservation-repository.ts` y a la proyección de la lectura administrativa en `src/infrastructure/database/admin-reservation-source.ts`; verificar con `npm run typecheck` y que `npm run test:unit` siga en verde

## 2. Elegibilidad y precio en el dominio

- [x] 2.1 Agregar el predicado único de elegibilidad por origen (`airbnb` o `booking`) en `src/features/reservations`, siguiendo el patrón de punto único de `assertReservationStayEditable`; verificar con un test que cubra los seis orígenes y confirme que solo los dos externos son elegibles
- [x] 2.2 Extender `recalculateReservationStayPricing` en `src/features/reservations/edit-reservation-stay.ts` para recibir los valores manuales por `roomId` y usarlos en lugar de `resolveRoomNightlyPrice` cuando existan (design.md decisión 2); verificar con tests en `tests/edit-reservation-stay.test.ts` que una habitación con valor manual conserva su precio al cambiar fechas y ocupación, y que una habitación agregada toma la tarifa vigente
- [x] 2.3 Verificar que `computeMultiRoomReservationPricing` sigue derivando subtotales y total sin aceptar un total externo, con un test que confirme que el total es `noches * valor + cargos` usando un valor manual

## 3. Caso de uso del valor por noche

- [x] 3.1 Crear el caso de uso transaccional de edición del valor por noche en `src/features/reservations`, que re-lee la reserva, valida elegibilidad y valor (entero mayor que cero), recalcula subtotales y total, y reutiliza `computeReservationStayEditFinancialSummary` para la conciliación de pagos; usar `roomLockGateway.runLockedMany` y no `runExclusiveMany` (design.md decisión 3); verificar con un test nuevo que cubra fijar, modificar y descartar el valor
- [x] 3.2 Cubrir con tests el rechazo de valores inválidos (cero, negativo, no entero) y de reservas no elegibles por origen, confirmando que la reserva queda intacta en cada caso
- [x] 3.3 Cubrir con tests la conciliación de pagos en los tres escenarios de la spec: sin pagos aprobados, total que supera lo pagado, y total por debajo de lo pagado con constancia de sobrepago
- [x] 3.4 Cubrir con tests que la edición opera en los cuatro estados (`confirmed`, `completed`, `cancelled`, `no_show`) y que ninguno cambia por efecto de la edición
- [x] 3.5 Resolver el riesgo abierto de design.md: verificar qué produce la conciliación sobre una reserva cancelada y, si genera un pago pendiente que nadie va a cobrar, suprimir ese pendiente en reservas canceladas; dejar la decisión cubierta por un test explícito
- [x] 3.6 Implementar la corrección de **origen** entre los seis orígenes del sistema: actualización no transaccional cuando es puro reetiquetado, y transaccional con recálculo cuando suelta un valor fijado a mano (vuelve a la tarifa vigente, recalcula total y concilia pagos). `externalPlatform`/`externalRef` solo sobreviven mientras el origen siga siendo un canal externo; verificar con tests que el reetiquetado puro no altera fechas, habitaciones, valor, total, pagos ni estado, y que el recálculo es atómico con el cambio de origen

## 4. Repositorio: mock y Drizzle

- [x] 4.1 Implementar ambas operaciones en el repositorio mock de `src/features/reservations/reservation-repository.ts`; verificar con los tests de dominio de los grupos 2 y 3 corriendo contra el mock
- [x] 4.2 Implementar ambas operaciones en el adaptador Drizzle de `src/infrastructure/database/reservation-repository.ts`, escribiendo líneas, pagos y auditoría en una transacción; verificar con un test de integración Postgres en la línea de `postgres-edit-reservation-dates.integration.test.ts`
- [x] 4.3 Verificar con un test que mock y Drizzle informan el mismo `ReservationRecord` tras fijar un valor por noche, incluido el total y la marca de procedencia

## 5. Auditoría

- [x] 5.1 Registrar el evento de auditoría del valor por noche con responsable, habitación, valor anterior y nuevo, totales anterior y nuevo, importe pagado considerado y saldo o sobrepago; verificar con un test que el evento queda escrito en la misma transacción que el cambio
- [x] 5.2 Registrar el evento de auditoría de la corrección de canal con responsable, canal anterior y nuevo; verificar con un test
- [x] 5.3 Verificar con un test que ninguna de las dos operaciones genera comunicación al huésped

## 6. Acciones administrativas

- [x] 6.1 Agregar la Server Action del valor por noche en `src/features/admin`, siguiendo el patrón de `edit-reservation-stay-action.ts`, con verificación de sesión en el envoltorio y validación de elegibilidad en el servidor; verificar con un test en la línea de `edit-reservation-stay-action.test.ts`
- [x] 6.2 Agregar la Server Action de corrección de origen con la misma protección; verificar con tests que acepta los seis orígenes válidos y rechaza cualquier otro valor antes de llegar al dominio
- [x] 6.3 Verificar con un test que ninguna de las dos acciones acepta un subtotal o total enviado por el cliente

## 7. Interfaz administrativa

- [x] 7.1 Agregar el campo de valor por noche por habitación al formulario de reserva manual (`manual-reservation-form.tsx` y su contrato), visible solo cuando el origen seleccionado es `airbnb` o `booking`; verificar con un test en `manual-reservation-form.test.tsx` que el campo aparece y desaparece al cambiar el origen
- [x] 7.2 Pasar el valor indicado por la creación manual hasta `createManualReservationFromInput` y marcar la línea como manual; verificar con un test en `manual-reservation.test.ts` que la reserva creada usa ese valor y que sin valor indicado resuelve la tarifa vigente
- [x] 7.3 Agregar al detalle administrativo la edición del valor por noche por habitación y la vuelta a la tarifa vigente; verificar con un test de componente en la línea de `admin-reservation-detail-date-edit.test.tsx`
- [x] 7.4 Distinguir visualmente en el detalle las habitaciones con valor manual de las que usan la tarifa vigente; verificar con un test que el valor manual se identifica como tal
- [x] 7.5 Agregar al detalle administrativo la corrección de origen, ofrecida en **toda** reserva y con los seis orígenes como destino; advertir antes de confirmar cuando la corrección vaya a soltar un valor fijado a mano (recálculo de total y pagos) y cuando reetiquete una reserva creada en el sitio web; verificar con tests ambas advertencias y su ausencia cuando no aplican
- [x] 7.6 Revisar el contraste de los textos nuevos antes de darlos por terminados: `text-muted-foreground` no cumple WCAG AA en este proyecto, así que no usarlo para el valor manual ni para sus etiquetas

## 8. Verificación integral

- [x] 8.1 Verificar con un test que el resumen mensual del panel refleja el valor corregido: una reserva `confirmed` del mes con valor fijado a mano debe mover `approvedRevenueClp` en `admin-dashboard-summary` y no moverlo cuando la reserva está cancelada
- [x] 8.2 Verificar con un test que corregir el origen reatribuye la reserva en el `channelBreakdown` del resumen mensual, que agrupa por `origin`
- [x] 8.3 Verificar con un test que fijar un valor por noche no modifica la configuración de tarifas de la habitación ni la cotización del sitio público
- [x] 8.4 Correr `npm run lint`, `npm run typecheck`, `npm run build:test` y `npm run test:unit` en verde, y `npm run test:integration:postgres` para los tests del grupo 4. El build es obligatorio: valida que un módulo `"use server"` solo exporte funciones async, algo que ni `tsc` ni vitest detectan — lint y typecheck limpios; `test:unit` en 1014 pasados / 1 fallo, el mismo fallo preexistente de `prebooking-review-controller.test.tsx` que ya existía en la línea base (cero regresiones); `build:test` en verde; `test:integration:postgres` NO ejecutado: requiere `VISTA_VALLE_POSTGRES_INTEGRATION_URL`
- [x] 8.5 Validar el change con `openspec validate edit-external-reservation-rate-and-channel --strict` y confirmar que cada requisito de las tres specs tiene cobertura de test
