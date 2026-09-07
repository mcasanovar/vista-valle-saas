## MODIFIED Requirements

### Requirement: Tarjetas KPI de la pantalla Resumen
El sistema SHALL presentar en la pantalla Resumen cuatro indicadores clave del mes seleccionado: total ganado (monto), reservas del mes (cantidad), ocupación promedio (porcentaje) y alertas abiertas (cantidad), cada uno con su variación respecto al periodo anterior cuando esté disponible. El indicador de alertas abiertas SHALL reflejar datos reales bajo contexto de producción, no solo bajo el contexto mock, y no se filtra por el mes seleccionado.

#### Scenario: Datos operativos disponibles
- **WHEN** el sistema puede calcular los indicadores operativos a partir de las reservas y pagos registrados para el mes seleccionado
- **THEN** el sistema muestra los cuatro indicadores con su valor actual y su variación

#### Scenario: Total ganado solo cuenta pagos aprobados
- **WHEN** el sistema calcula el total ganado del mes
- **THEN** el sistema suma únicamente el monto de los pagos con estado aprobado asociados a reservas cuya fecha de entrada cae en el mes seleccionado, sin incluir pagos pendientes, rechazados ni reembolsados

#### Scenario: Reservas del mes excluye canceladas y no-show
- **WHEN** el sistema calcula el indicador de reservas del mes
- **THEN** el sistema cuenta únicamente las reservas en estado confirmada o completada cuya fecha de entrada cae en el mes seleccionado, sin incluir las canceladas ni las que no se presentaron

#### Scenario: Pago pendiente en el mock administrativo
- **WHEN** una reserva mock tiene `paymentStatus` pendiente
- **THEN** el sistema no suma su `totalClp` en el total ganado del mes, sin inferir el estado de pago a partir del estado de la reserva

#### Scenario: Alertas abiertas en producción
- **WHEN** el sistema calcula el indicador de alertas abiertas bajo contexto de producción
- **THEN** el sistema cuenta, como mínimo, pagos "al llegar" pendientes y conflictos de sincronización de canal a partir de datos persistidos, sin depender de datos mock ni devolver el indicador como no disponible únicamente por no estar en contexto mock. Notificaciones fallidas se suma a este conteo cuando exista un procesador de outbox de producción que pueda marcar una notificación como fallida; hasta entonces el indicador no las incluye.

#### Scenario: Datos operativos no disponibles
- **WHEN** el sistema no puede calcular los indicadores operativos
- **THEN** el sistema comunica explícitamente que el resumen operativo no está disponible, sin mostrar valores inventados ni tarjetas vacías silenciosas

### Requirement: Retroalimentación de carga en pantallas admin
El sistema SHALL mostrar bloques con animación de carga (shimmer) en lugar del contenido real mientras las tarjetas KPI, la tabla de reservas recientes, el desglose por canal, la ocupación por habitación y el gráfico de ventas están cargando datos, y SHALL reflejar el estado de carga en el botón "Actualizar datos" sin ocultar su etiqueta. Un cambio de mes en el selector SHALL activar el mismo estado de carga sobre las secciones que dependen del mes.

#### Scenario: Carga inicial de la pantalla Resumen
- **WHEN** la pantalla Resumen está obteniendo los datos operativos
- **THEN** el sistema muestra bloques con shimmer en el lugar de las tarjetas KPI, de las filas de la tabla, del desglose por canal, de la ocupación por habitación y del gráfico de ventas, en vez de contenido parcial o valores en cero

#### Scenario: Actualización manual de datos
- **WHEN** un administrador presiona "Actualizar datos" y la operación está en curso
- **THEN** el botón se deshabilita, reemplaza su ícono por un indicador de carga y conserva su etiqueta de texto (igual o cambiada a "Actualizando…"), nunca solo un indicador de carga sin texto

#### Scenario: Cambio de mes mientras se cargan datos nuevos
- **WHEN** un administrador selecciona un mes distinto mientras las secciones dependientes del mes obtienen sus nuevos datos
- **THEN** el sistema muestra shimmer en esas secciones en vez de mostrar momentáneamente los valores del mes anterior como si fueran del mes nuevo

## ADDED Requirements

### Requirement: Selector de mes en la pantalla Resumen
El sistema SHALL presentar un selector de mes en la pantalla Resumen que ancla todo el contenido operativo calculado por mes (tarjetas KPI salvo alertas abiertas, reservas canceladas y no-show, desglose por canal, ocupación por habitación y gráfico de ventas) a la fecha de entrada (`checkIn`) de cada reserva, independientemente de cuándo se creó la reserva o se recibió su pago. La tabla de reservas recientes y el indicador de alertas abiertas SHALL permanecer sin filtrar por el mes seleccionado.

#### Scenario: Cambio de mes
- **WHEN** un administrador selecciona un mes distinto en el selector de la pantalla Resumen
- **THEN** el sistema recalcula y muestra el total ganado, reservas del mes, canceladas, no-show, ocupación promedio, desglose por canal, ocupación por habitación y el gráfico de ventas usando únicamente reservas cuya fecha de entrada cae en el mes seleccionado

#### Scenario: Reserva pagada por adelantado para un mes futuro
- **WHEN** una reserva se crea y se paga en un mes calendario distinto al de su fecha de entrada
- **THEN** el sistema atribuye su monto ganado, su ocupación y su conteo al mes de la fecha de entrada, no al mes en que se creó o se pagó

#### Scenario: Secciones que no se filtran por mes
- **WHEN** un administrador cambia el mes seleccionado en la pantalla Resumen
- **THEN** el indicador de alertas abiertas y la tabla de reservas recientes no cambian su contenido en función del mes seleccionado

### Requirement: Reservas canceladas y no-show del mes
El sistema SHALL mostrar, en la pantalla Resumen, el total de reservas canceladas y el total de reservas que no se presentaron (no-show) cuya fecha de entrada cae en el mes seleccionado, de forma separada del indicador de reservas del mes.

#### Scenario: Mes con cancelaciones y no-show
- **WHEN** existen reservas canceladas o marcadas como no-show con fecha de entrada en el mes seleccionado
- **THEN** el sistema muestra ambos totales de forma visible y diferenciada entre sí

#### Scenario: Mes sin cancelaciones ni no-show
- **WHEN** no existen reservas canceladas ni no-show con fecha de entrada en el mes seleccionado
- **THEN** el sistema muestra ambos totales en cero, sin ocultar los indicadores

### Requirement: Desglose de reservas por canal en la pantalla Resumen
El sistema SHALL presentar, en la pantalla Resumen, un desglose de las reservas del mes seleccionado por canal de origen (sitio web, Airbnb, Booking, teléfono, WhatsApp, admin), mostrando para cada canal el monto ganado (pagos aprobados) y la cantidad de reservas, de forma que ambos valores sean distinguibles sin ambigüedad en la misma visualización.

#### Scenario: Canales con actividad en el mes
- **WHEN** existen reservas válidas (confirmada o completada) con fecha de entrada en el mes seleccionado
- **THEN** el sistema agrupa su monto ganado y su cantidad por canal de origen y presenta ambos valores en el mismo elemento visual de cada canal

#### Scenario: Canal sin reservas en el mes
- **WHEN** un canal de origen no tiene reservas con fecha de entrada en el mes seleccionado
- **THEN** el sistema no omite el desglose completo por la ausencia de un canal; ese canal aparece en cero en vez de desaparecer

### Requirement: Ocupación por habitación en la pantalla Resumen
El sistema SHALL presentar, en la pantalla Resumen, la ocupación del mes seleccionado desglosada por habitación. Una noche de una habitación SHALL contarse como ocupada cuando está cubierta por una reserva en estado confirmada o completada que tenga al menos un pago aprobado; el porcentaje de cada habitación SHALL calcularse sobre el total de noches del mes en que esa habitación está activa.

#### Scenario: Habitación con reservas pagadas en el mes
- **WHEN** una habitación tiene noches del mes seleccionado cubiertas por reservas confirmadas o completadas con pago aprobado
- **THEN** el sistema cuenta esas noches como ocupadas para esa habitación al calcular su porcentaje

#### Scenario: Reserva confirmada sin pago aprobado
- **WHEN** una habitación tiene una reserva confirmada para el mes seleccionado cuyo pago aún no está aprobado
- **THEN** el sistema no cuenta esas noches como ocupadas para esa habitación

#### Scenario: Habitación inactiva durante parte del mes
- **WHEN** una habitación no está activa durante parte del mes seleccionado
- **THEN** el sistema excluye esos días del total de noches disponibles de esa habitación al calcular su porcentaje

### Requirement: Gráfico de ventas del mes en la pantalla Resumen
El sistema SHALL presentar, en la pantalla Resumen, un gráfico del monto ganado (pagos aprobados) agregado por día de fecha de entrada dentro del mes seleccionado.

#### Scenario: Mes con ventas distribuidas en varios días
- **WHEN** existen pagos aprobados de reservas con distintas fechas de entrada dentro del mes seleccionado
- **THEN** el sistema muestra el monto ganado agregado por cada día correspondiente en el gráfico

#### Scenario: Mes sin ventas
- **WHEN** no existen pagos aprobados de reservas con fecha de entrada en el mes seleccionado
- **THEN** el sistema comunica explícitamente que no hay ventas registradas en el mes, sin mostrar un gráfico vacío sin explicación
