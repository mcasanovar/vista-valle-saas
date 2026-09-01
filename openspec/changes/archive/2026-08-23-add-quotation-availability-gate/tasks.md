## 1. Cobertura parcial en el cálculo autoritativo

- [x] 1.1 Modificar `calculateCompanyQuotation` para que ya no lance `CompanyQuotationCapacityError` cuando `guestCount` supera la capacidad seleccionada; actualizar el test existente que esperaba ese error y agregar una prueba que verifique que la cotización se calcula igual, con `capacity` reflejando lo realmente seleccionado
- [x] 1.2 Actualizar `CompanyQuotationCustomerEmail` y `CompanyQuotationAdminEmail` para declarar explícitamente si la cotización cubre a todas las personas solicitadas y, si no, cuántas cubre; verificar con pruebas de renderizado de plantillas los casos de cobertura completa y parcial
- [x] 1.3 Actualizar `CompanyQuotationForm` para que el faltante de capacidad se muestre como aviso persistente sin bloquear el envío; verificar que el formulario permite enviar con capacidad insuficiente y que el aviso sigue visible tras el envío

## 2. Resolución de disponibilidad agregada

- [x] 2.1 Implementar `resolveCompanyQuotationAvailability(dateRange)` reutilizando `RoomReadSource.listActive()`, `AvailabilityRepository.listOccupyingIntervals` y `checkRoomAvailability`, agrupando por nombre/tipo de habitación con conteo de unidades libres y capacidad; verificar con pruebas unitarias que agrupa correctamente y no filtra por capacidad individual
- [x] 2.2 Extender los fixtures mock de ocupación (reservas/holds) usados en pruebas para cubrir 0, 1 y varias habitaciones libres en un mismo rango de fechas; verificar que los tres escenarios (total, parcial, nula) son reproducibles en pruebas
- [x] 2.3 Cubrir con pruebas unitarias los casos de disponibilidad total, parcial suficiente, parcial insuficiente y nula, verificando el conteo de habitaciones y la capacidad total devueltos en cada caso

## 3. Endpoint de disponibilidad previo al formulario

- [x] 3.1 Exponer un endpoint server-side que reciba fecha de entrada, fecha de salida y personas, valide su formato y llame a `resolveCompanyQuotationAvailability`; verificar con pruebas de integración que rechaza fechas ausentes, inválidas o no ordenadas y cantidades de personas fuera de los límites permitidos sin consultar disponibilidad
- [x] 3.2 Verificar con pruebas de integración que el endpoint devuelve habitaciones agrupadas por tipo con unidades disponibles, capacidad máxima y capacidad total para los casos de disponibilidad total, parcial y nula

## 4. Paso 1 de la página: fechas y personas

- [x] 4.1 Rediseñar `app/cotizacion-empresa` como controlador cliente con paso 1 (fecha de entrada, fecha de salida, personas) que valida los campos localmente antes de consultar disponibilidad; verificar que campos inválidos bloquean la consulta y marcan el campo correspondiente
- [x] 4.2 Conectar el paso 1 al endpoint de disponibilidad (tarea 3.1) y manejar los estados de carga y error de red; verificar operación con teclado y que el control de envío queda ocupado durante la consulta

## 5. Paso 2 de la página: resultado y formulario acotado

- [x] 5.1 Mostrar el mensaje de disponibilidad (habitaciones disponibles y capacidad total) para los casos de disponibilidad total, parcial suficiente, parcial insuficiente y nula; verificar que el mensaje correcto se muestra en cada uno de los cuatro casos
- [x] 5.2 Renderizar el formulario de selección de habitaciones acotado a las unidades disponibles por tipo, sin permitir cantidades por sobre lo disponible, y ocultarlo por completo cuando la disponibilidad es nula; verificar con pruebas de componente que los límites de cantidad respetan la disponibilidad recibida
- [x] 5.3 Mostrar un aviso visible de capacidad faltante cuando la disponibilidad sea parcial insuficiente, permitiendo continuar con una cotización parcial (usa el aviso no bloqueante de la tarea 1.3); verificar que el aviso persiste junto al formulario hasta el envío
- [x] 5.4 Al modificar fechas o personas después de un resultado, volver a consultar disponibilidad y reemplazar mensaje y formulario; verificar con pruebas de componente que el estado anterior no queda visible junto al nuevo resultado

## 6. Revalidación server-authoritative en el envío

- [x] 6.1 Extender `POST /api/company-quotations` para volver a ejecutar `resolveCompanyQuotationAvailability` con las fechas recibidas antes de llamar a `calculateCompanyQuotation`; verificar con pruebas de integración que usa disponibilidad recién calculada, no la enviada por el cliente
- [x] 6.2 Rechazar líneas cuya cantidad exceda las unidades libres vigentes al momento del envío con un error específico que indique la disponibilidad vigente; verificar con una prueba de integración que simula disponibilidad reducida entre la consulta inicial y el envío

## 7. Regresión y cobertura end-to-end

- [x] 7.1 Agregar pruebas E2E para los tres escenarios de disponibilidad (total, parcial, nula) desde el ingreso de fechas/personas hasta ver el formulario o el mensaje correspondiente, incluyendo el envío de una cotización parcial; verificar con `npm run test:e2e`
- [x] 7.2 Verificar con pruebas de regresión que el cálculo de precios, noches, subtotales y total, y el envío de correos de confirmación/operativo, no cambian de contrato para el caso de disponibilidad total con cobertura completa
- [x] 7.3 Ejecutar `npm run typecheck` y `npm run lint` y verificar que ambos pasan sin errores

## 8. Modal de confirmación de envío

- [x] 8.1 Reemplazar el panel de éxito inline (con líneas y total) por un modal accesible que confirme el envío sin montos, habitaciones ni cantidades; verificar con pruebas de componente que el modal no muestra precios ni cantidades
- [x] 8.2 Implementar el cierre del modal mediante botón, clic en el fondo y tecla Escape, los tres redirigiendo a la página de inicio; verificar con pruebas de componente los tres caminos de cierre
- [x] 8.3 Implementar el cierre automático a los 5 segundos que redirige a la página de inicio, limpiando el temporizador si el modal se cierra antes por otro medio; verificar con pruebas de componente usando temporizadores simulados
- [x] 8.4 Agregar una prueba E2E que envíe una cotización y verifique que el modal aparece, se puede cerrar de al menos una forma, y redirige a la página de inicio

## 9. Contador visible y selección por botón

- [x] 9.1 Mostrar en el modal de confirmación un contador visible con los segundos restantes hasta el cierre automático, actualizado cada segundo; verificar con pruebas de componente usando temporizadores simulados
- [x] 9.2 Reemplazar el stepper +/- de cantidad por habitación en `CompanyQuotationForm` por un botón "Seleccionar"/"Seleccionado" (selección binaria, máximo 1 unidad por tipo aunque haya más disponibles); verificar con pruebas de componente que el botón alterna correctamente y que la capacidad seleccionada se recalcula
- [x] 9.3 Actualizar las pruebas E2E de `company-quotation.spec.ts` que interactúan con "Aumentar"/"Disminuir" para usar el nuevo botón "Seleccionar"; verificar con `npm run test:e2e`
