## Context

Ver `proposal.md` para la motivación. Contratos observables en `specs/company-quotation-flow/spec.md`.

Hoy cada habitación es una unidad individual con `slug` único (no existe un campo de cantidad por tipo): los fixtures mock modelan "Individual", "Matrimonial" y "Doble" como tres filas de habitación, una por tipo. `app/cotizacion-empresa/page.tsx` y `app/api/company-quotations/route.ts` obtienen habitaciones vía `RoomReadSource.listActive()` y las pasan a `calculateCompanyQuotation`, que solo valida capacidad matemática (`sum(capacity*quantity) >= guestCount`); nunca consulta ocupación por fecha.

La disponibilidad por fecha ya existe como contrato reutilizable: `AvailabilityRepository.listOccupyingIntervals(roomId)` (reservas confirmadas, holds vigentes, bloqueos activos) y `checkRoomAvailability(occupying, requested)` (solapamiento de intervalos `[checkIn, checkOut)`), orquestados hoy en `searchAvailability` para `availability-search-experience`. `searchAvailability` no sirve tal cual porque filtra habitaciones por `capacity >= guests` por habitación individual; la cotización empresarial necesita la disponibilidad de **todas** las habitaciones activas del rango, sin ese filtro por habitación, porque la capacidad se evalúa de forma acumulada entre varias habitaciones.

## Goals / Non-Goals

**Goals:**

- Resolver disponibilidad real (ocupación por fecha) de las habitaciones activas antes de construir el formulario de cotización empresarial, reutilizando los contratos de ocupación ya usados por disponibilidad pública.
- Acotar la selección de habitaciones a los tipos realmente libres por tipo de habitación para el rango consultado, permitiendo como máximo una unidad seleccionada por tipo aunque haya varias disponibles.
- Revalidar disponibilidad en el servidor al momento del envío, con la misma fuente autorizada usada para mostrar el formulario.
- Mantener el flujo utilizable con el inventario mock actual (una unidad por tipo) sin asumir un campo de cantidad que no existe en el modelo.

**Non-Goals:**

- No crear reservas, holds ni bloqueos de disponibilidad a partir de la cotización empresarial (la cotización sigue sin comprometer inventario).
- No introducir un campo de "cantidad de unidades por tipo" en el modelo de habitaciones; la disponibilidad se calcula agrupando habitaciones activas por nombre/tipo en tiempo de consulta.
- No cambiar el contrato de cálculo de precios, noches, subtotales o total ya definido para la cotización.
- No cambiar el proveedor de correo, el mecanismo de outbox ni el resto del flujo de notificaciones; el único cambio en las plantillas es agregar un aviso explícito de cobertura de personas (Decisión 5).
- No mostrar montos, habitaciones ni cantidades en el modal de confirmación de envío — esos datos solo viven en el correo (Decisión 6).

## Decisions

### 1. Nueva función de resolución de disponibilidad agregada, separada de `searchAvailability`

Se agrega una función (por ejemplo `resolveCompanyQuotationAvailability(dateRange)`) que reutiliza `RoomReadSource.listActive()`, `AvailabilityRepository.listOccupyingIntervals` y `checkRoomAvailability`, pero sin el filtro `capacity >= guests` por habitación individual: devuelve, para cada habitación activa, si está libre en el rango, y agrupa el resultado por nombre/tipo de habitación con conteo de unidades libres y capacidad máxima.

Se evita reutilizar `searchAvailability` directamente porque su contrato de salida está pensado para listar habitaciones que individualmente satisfacen a un huésped, no para sumar capacidad entre varias habitaciones de distinto tipo.

### 2. Página en dos pasos con un endpoint de disponibilidad previo al formulario

`app/cotizacion-empresa` pasa a un controlador cliente con dos estados: paso 1 (fecha de entrada, fecha de salida, personas) y paso 2 (resultado de disponibilidad + formulario acotado o mensaje sin formulario). El paso 1, al validar sus campos, consulta un endpoint server-side (extensión de la API de cotización empresarial) que ejecuta `resolveCompanyQuotationAvailability` y devuelve habitaciones disponibles agrupadas, conteo total y capacidad total.

Se mantiene la separación server/client ya usada por la página: el cliente nunca decide disponibilidad, solo la solicita y renderiza el resultado.

### 3. El formulario de selección se construye solo con datos ya acotados por el servidor

El formulario de paso 2 recibe la respuesta de disponibilidad y ofrece un botón de selección ("Seleccionar" / "Seleccionado") por cada tipo con al menos una unidad libre, en vez de un campo de cantidad: la selección es binaria por tipo (0 o 1 unidad), sin importar cuántas unidades de ese tipo estén realmente libres (`availableUnits` solo se usa para decidir si el botón está disponible, no para fijar un máximo mayor a 1 — decisión tomada con el usuario). No ofrece el botón para tipos sin unidades libres. Cuando la capacidad disponible no cubre la cantidad de personas solicitada, el formulario se muestra igualmente permitiendo enviar una cotización parcial, con un aviso visible del faltante.

### 4. Revalidación server-authoritative en el envío

El endpoint de envío (`POST /api/company-quotations`) vuelve a ejecutar `resolveCompanyQuotationAvailability` para las fechas recibidas antes de llamar a `calculateCompanyQuotation`, y rechaza cualquier línea cuya cantidad exceda las unidades libres vigentes en ese momento, devolviendo un error específico. Esto cubre la ventana entre que el visitante ve el resultado de disponibilidad y el momento del envío.

### 5. Cobertura parcial explícita en el cálculo y en los correos

Decisión tomada con el usuario: cuando la capacidad seleccionada (ya acotada a lo disponible) no alcanza para `guestCount`, el envío SHALL completarse en lugar de rechazarse. `calculateCompanyQuotation` deja de lanzar `CompanyQuotationCapacityError` por este motivo: en su lugar, el resultado expone si la cotización cubre a todas las personas solicitadas y, si no, cuántas cubre (usando los campos ya existentes `guestCount` y `capacity`, sin nuevos campos de esquema ni persistencia).

Las plantillas `CompanyQuotationCustomerEmail` y `CompanyQuotationAdminEmail` (JSX, no usadas por el worker) y sus equivalentes realmente entregados `renderCompanyQuotationCustomerEmail`/`renderCompanyQuotationAdminEmail` en `email-template-renderer.ts` agregan una línea que declara explícitamente la cobertura ("Cotización para N de M personas solicitadas" o equivalente) cuando `capacity < guestCount`, para que ni el cliente ni el equipo operativo interpreten una cotización parcial como cobertura completa. El formulario cliente dejará de bloquear el envío por este motivo; el aviso de faltante pasa de error bloqueante a aviso informativo persistente.

Se descarta mantener el bloqueo porque contradice directamente el requirement modificado "Selección de habitaciones y capacidad visible" (escenario "Capacidad insuficiente"): si el envío sigue bloqueado, mostrar el formulario acotado no aporta nada distinto a hoy.

### 6. Modal de confirmación con cierre uniforme y redirección

Se reemplaza el panel de éxito inline (que hoy muestra líneas y total tras el envío) por un modal accesible (`role="dialog"`, `aria-modal`, foco inicial en el botón de cierre, atrapa el foco) que solo confirma que la cotización fue enviada al correo indicado. Los cuatro caminos de cierre — botón, clic en el fondo, tecla Escape y el temporizador de 5 segundos — usan el mismo handler `closeAndRedirect`, que cierra el modal y navega a `/`. El temporizador se limpia si el modal se cierra antes por cualquier otro medio, para no redirigir dos veces ni dejarlo pendiente tras desmontar.

Se evita mostrar montos en el modal porque el usuario ya los recibirá en el correo de confirmación; repetirlos en el modal duplicaría información sensible en pantalla sin aportar valor adicional.

El modal muestra un contador visible con los segundos restantes, derivado del mismo temporizador que dispara `closeAndRedirect` (por ejemplo, un `setInterval` de 1s que decrementa un estado local hasta 0, en paralelo al `setTimeout` de 5000ms, o un único intervalo que calcula el tiempo restante); ambos se limpian juntos en cualquier camino de cierre y al desmontar, para que el número mostrado nunca quede desincronizado del cierre real.

## Risks / Trade-offs

- [Riesgo] Condición de carrera entre el resultado de disponibilidad mostrado y el envío final (otra solicitud o reserva ocupa una habitación en el medio) → [Mitigación] revalidación server-authoritative en el envío (Decisión 4), con error específico y sin generar cotización sobre inventario ya no disponible.
- [Riesgo] Agrupar habitaciones "por tipo" usando el nombre de la habitación, al no existir un campo de tipo explícito en el modelo → [Mitigación] documentar la convención (nombre = tipo) y mantenerla consistente con cómo ya se presentan las habitaciones en `availability-search-experience`.
- [Riesgo] El inventario mock actual solo tiene una unidad por tipo, lo que limita las combinaciones de prueba para "disponibilidad parcial" → [Mitigación] extender los fixtures de ocupación mock (reservas/holds) usados en pruebas para cubrir escenarios de 0, 1 y varias habitaciones libres sin cambiar el inventario de habitaciones.
- [Riesgo] Mostrar el formulario en el caso de capacidad insuficiente puede confundirse con una cotización completa → [Mitigación] el aviso de faltante de capacidad debe ser visible junto al formulario, persistir en el resumen antes del envío, y quedar declarado explícitamente en ambos correos (Decisión 5).
- [Riesgo] Relajar `CompanyQuotationCapacityError` puede ocultar un error real de UI que envíe cantidades absurdamente bajas → [Mitigación] la cotización sigue siendo server-authoritative y acotada a disponibilidad real; el faltante de cobertura queda registrado en el snapshot y visible en ambos correos, no se envía en silencio.
- [Riesgo] El temporizador de 5 segundos podría seguir corriendo tras un cierre manual o un desmontaje del componente y disparar una redirección adicional → [Mitigación] un único handler `closeAndRedirect` y limpieza del temporizador (`clearTimeout`) en cualquier camino de cierre y al desmontar (Decisión 6).

## Migration Plan

1. Implementar `resolveCompanyQuotationAvailability` reutilizando los contratos de ocupación existentes, con pruebas unitarias para los casos total/parcial/nulo.
2. Exponer el resultado a través de un endpoint server-side y consumirlo desde el paso 1 de la página.
3. Rediseñar `app/cotizacion-empresa` como flujo de dos pasos, acotando el formulario de paso 2 a la disponibilidad recibida.
4. Extender la validación del envío para revalidar disponibilidad antes de calcular y persistir la cotización.
5. Agregar pruebas E2E para disponibilidad total, parcial y nula, y pruebas de regresión sobre el cálculo de cotización existente.
6. Para rollback: revertir la página al flujo de un solo paso y retirar la revalidación de disponibilidad en el envío; no hay cambios de esquema que revertir.
