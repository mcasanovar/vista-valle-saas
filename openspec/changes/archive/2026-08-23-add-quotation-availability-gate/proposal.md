## Why

El flujo de cotización empresarial en `/cotizacion-empresa` permite construir y enviar una solicitud sin haber verificado antes si existe disponibilidad real para las fechas solicitadas. Hoy solo valida capacidad matemática agregada (suma de capacidad × cantidad ≥ personas), pero nunca consulta si esas habitaciones están ocupadas en el rango de fechas, por lo que una empresa puede recibir una cotización para habitaciones que ya están reservadas. Se necesita validar fechas, personas y disponibilidad real antes de mostrar el formulario de selección, para evitar cotizaciones que no se pueden cumplir y para informar de inmediato cuántas habitaciones y para cuántas personas hay disponibilidad real.

## What Changes

- Reordenar la página `/cotizacion-empresa` en dos pasos: (1) el visitante ingresa fecha de entrada, fecha de salida y cantidad total de personas; (2) el sistema resuelve la disponibilidad real de habitaciones para ese rango (ocupación por fecha, reutilizando el mismo contrato de disponibilidad usado por `availability-search-experience`) y solo entonces continúa el flujo.
- Antes de mostrar el formulario de selección de habitaciones, informar siempre al visitante cuántas habitaciones están disponibles para esas fechas y para cuántas personas en total (capacidad sumada de esas habitaciones), tanto si la disponibilidad cubre todas las habitaciones, como si cubre solo algunas o solo una.
- Mostrar el formulario de selección de habitaciones/cantidades acotado únicamente a las habitaciones realmente disponibles para el rango consultado (sin permitir elegir cantidades por sobre las unidades libres), incluso cuando la capacidad disponible no alcance para el total de personas solicitado; en ese caso se debe indicar con claridad el faltante de capacidad para que la empresa pueda ajustar fechas, personas, o continuar con una cotización parcial sobre lo que sí está disponible.
- Cuando no exista ninguna habitación disponible para las fechas consultadas, no mostrar el formulario de selección; mostrar solo el mensaje informativo de disponibilidad nula y una vía para ajustar fechas o personas.
- Revalidar disponibilidad y capacidad en el servidor al momento del envío de la cotización (no solo al cargar el paso inicial), usando las mismas fuentes autorizadas, para evitar cotizaciones construidas sobre disponibilidad obsoleta o manipulada desde el cliente.
- Mantener sin cambios de contrato el resto del cálculo autoritativo de cotización (noches, precio por noche, subtotales, total).
- Al confirmar el envío exitoso de la cotización, mostrar un modal de confirmación sin montos, habitaciones ni cantidades (esa información llega por correo), cerrable con un botón, con un clic fuera del modal o con la tecla Escape, con cierre automático a los 5 segundos, y redirigir siempre a la página de inicio del sitio al cerrarse por cualquiera de esos medios.
- Reemplazar el selector de cantidad (+/-) por habitación en el formulario de cotización por un botón de selección única "Seleccionar"/"Seleccionado": cada tipo de habitación admite como máximo una unidad seleccionada por cotización, aunque haya más de una unidad disponible.
- Mostrar en el modal de confirmación un contador visible con los segundos restantes hasta el cierre automático.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `company-quotation-flow`: se agrega un paso previo de fechas/personas con verificación de disponibilidad real por fecha (no solo capacidad agregada) antes de mostrar el formulario, mensajes de disponibilidad total/parcial/nula, acotamiento de las cantidades ofrecidas a las habitaciones realmente libres, y revalidación server-authoritative de disponibilidad al enviar la solicitud.

## Impact

- Frontend: rediseño de `/cotizacion-empresa` en un flujo de dos pasos (fechas/personas → resultado de disponibilidad → formulario acotado o mensaje de disponibilidad insuficiente/nula); modal de confirmación de envío con temporizador de 5 segundos y redirección a la página de inicio.
- Backend: nueva resolución de disponibilidad de habitaciones por fecha antes de construir el formulario, reutilizando `AvailabilityRepository` / `checkRoomAvailability` ya usados por `availability-search-experience`; extensión de la validación de `calculateCompanyQuotation` (o su capa previa) para rechazar en el servidor líneas que excedan la disponibilidad real vigente al momento del envío.
- Datos: sin cambios de esquema; se reutiliza el modelo de habitaciones y ocupación existente. No se crean reservas, holds ni bloqueos a partir de la cotización.
- Pruebas: unitarias para el cálculo de disponibilidad agregada por fecha, integración del paso de disponibilidad, E2E para los tres escenarios (disponibilidad total, parcial y nula) y regresión del cálculo de cotización existente.
- Dependencia de secuencia: este change asume que `company-quotation-flow` existe como capability base en `openspec/specs/` (es decir, que `add-company-quotation-flow` se archiva antes o junto con este change), ya que aquí solo se declaran los requirements que se modifican, no el flujo completo.
