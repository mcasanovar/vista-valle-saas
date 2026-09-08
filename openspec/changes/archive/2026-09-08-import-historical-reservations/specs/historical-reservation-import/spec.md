## Purpose

Trasladar por única vez el historial comercial de Vista Valle desde una planilla Excel hacia la base de datos del sistema, homologando sus campos al modelo vigente, saneando las filas defectuosas de forma auditable y dejando el panel administrativo mostrando ingresos, ocupación y reservas vigentes reales en lugar de datos de prueba.

## ADDED Requirements

### Requirement: Lectura completa de la planilla histórica
El sistema SHALL leer los tres bloques de reservas de la pestaña `homologado` del archivo Excel indicado y SHALL rechazar la ejecución completa si alguno de los bloques no presenta la estructura de encabezados esperada.

Los bloques no están apilados verticalmente: 2024 y 2025 conviven en la misma banda de filas ocupando rangos de columnas distintos.

#### Scenario: Los tres bloques se leen íntegramente
- **WHEN** el operador ejecuta el import sobre la planilla histórica
- **THEN** el sistema lee las 216 filas del bloque 2024, las 272 filas del bloque 2025 y las 208 filas del bloque 2026, y reporta el total leído antes de cualquier otra etapa

#### Scenario: Encabezados alterados
- **WHEN** un bloque no expone los encabezados esperados en la fila de encabezado de su rango
- **THEN** el sistema aborta sin borrar ni escribir nada e informa qué bloque no pudo interpretar

#### Scenario: Pestaña ausente
- **WHEN** el libro no contiene una pestaña llamada `homologado`
- **THEN** el sistema aborta e informa las pestañas disponibles

### Requirement: Homologación de piezas a habitaciones del catálogo
El sistema SHALL traducir el tipo de pieza de cada fila a la habitación correspondiente del catálogo y SHALL rechazar la fila cuando el valor no corresponda a ninguna habitación conocida.

La correspondencia es: `Chica` a la habitación individual, `Grande` a la habitación matrimonial y `extra grande` a la habitación doble. La comparación SHALL ser insensible a mayúsculas y a espacios circundantes.

#### Scenario: Pieza reconocida
- **WHEN** una fila declara la pieza `extra grande`
- **THEN** el sistema asocia la reserva a la habitación doble del catálogo

#### Scenario: Pieza desconocida
- **WHEN** una fila declara una pieza que no corresponde a ninguna de las tres conocidas
- **THEN** el sistema rechaza esa fila, la incluye en el reporte con su bloque y número de fila, y continúa procesando el resto

#### Scenario: Habitación ausente del catálogo
- **WHEN** alguna de las tres habitaciones esperadas no existe en la base de datos
- **THEN** el sistema aborta antes de borrar o escribir nada e informa qué habitación falta

### Requirement: Homologación de plataforma a origen de reserva
El sistema SHALL traducir la plataforma de origen declarada en la planilla al origen de reserva del sistema.

La correspondencia es: `booking` a origen Booking, `arbnb` a origen Airbnb, y `otro` o el valor vacío a origen WhatsApp. La comparación SHALL ser insensible a mayúsculas y a espacios circundantes.

#### Scenario: Plataforma con nombre mal escrito en la planilla
- **WHEN** una fila declara la plataforma `arbnb`
- **THEN** el sistema registra la reserva con origen Airbnb

#### Scenario: Plataforma vacía
- **WHEN** una fila no declara plataforma
- **THEN** el sistema registra la reserva con origen WhatsApp

### Requirement: Homologación del estado de pago a estado de reserva y pago
El sistema SHALL derivar de la columna de estado de pago tanto el estado de la reserva como la existencia y el estado de su pago asociado, considerando además si la estadía ya terminó al momento de ejecutar el import.

- Estado `Cancelado`: la reserva se registra como cancelada y no genera pago.
- Estado `Pagado` o `Pendiente` con fecha de salida anterior o igual a la fecha de ejecución: la reserva se registra como completada.
- Estado `Pagado` o `Pendiente` con fecha de salida posterior a la fecha de ejecución: la reserva se registra como confirmada.
- Estado `Pagado`: genera un pago aprobado.
- Estado `Pendiente`: genera un pago pendiente.

#### Scenario: Estadía pasada y pagada
- **WHEN** una fila marcada `Pagado` tiene fecha de salida anterior a la fecha de ejecución
- **THEN** el sistema registra una reserva completada con un pago aprobado por el total neto de la fila

#### Scenario: Estadía vigente aún no pagada
- **WHEN** una fila marcada `Pendiente` tiene fecha de salida posterior a la fecha de ejecución
- **THEN** el sistema registra una reserva confirmada con un pago pendiente, de modo que la habitación queda ocupada frente a la búsqueda de disponibilidad

#### Scenario: Reserva cancelada
- **WHEN** una fila está marcada `Cancelado`
- **THEN** el sistema registra una reserva cancelada sin pago asociado, que no ocupa la habitación ni aporta a los ingresos

#### Scenario: Estado desconocido
- **WHEN** una fila declara un estado de pago distinto de `Pagado`, `Pendiente` o `Cancelado`
- **THEN** el sistema rechaza esa fila y la incluye en el reporte

### Requirement: Saneamiento de fechas con año corrupto
El sistema SHALL corregir las fechas cuyo año quede fuera del rango cubierto por la planilla conservando su día y mes y reemplazando el año por el del bloque al que pertenece la fila, y SHALL validar el resultado contra la cantidad de noches declarada.

#### Scenario: Año fuera de rango recuperable
- **WHEN** una fila del bloque 2025 declara una fecha de entrada en el año 2028 y la corrección por año produce un intervalo igual a la cantidad de noches declarada
- **THEN** el sistema adopta la fecha corregida y registra la corrección en el reporte

#### Scenario: Corrección que no cuadra con las noches declaradas
- **WHEN** la corrección por año produce un intervalo distinto de la cantidad de noches declarada
- **THEN** el sistema rechaza esa fila y la incluye en el reporte en lugar de adoptar una fecha dudosa

#### Scenario: Fecha sin día ni mes recuperables
- **WHEN** una fila declara una fecha que no corresponde a un día calendario del que puedan rescatarse día y mes
- **THEN** el sistema rechaza esa fila salvo que exista una corrección explícita declarada para ella

### Requirement: Correcciones explícitas de filas individuales
El sistema SHALL aplicar un conjunto declarado de correcciones puntuales, identificadas por bloque y número de fila, para las filas cuyo defecto no puede resolverse mediante una regla general, y SHALL advertir cuando una corrección declarada no encuentre su fila.

#### Scenario: Corrección puntual aplicada
- **WHEN** una fila tiene una corrección declarada para sus fechas, su valor por noche o su total
- **THEN** el sistema usa los valores corregidos y deja constancia de la corrección en el reporte

#### Scenario: Corrección declarada que no calza
- **WHEN** una corrección declarada apunta a una fila cuyo contenido ya no coincide con el esperado
- **THEN** el sistema aborta antes de borrar o escribir nada, porque la planilla cambió respecto del análisis que originó la corrección

### Requirement: Prioridad de la cantidad de noches sobre las fechas
El sistema SHALL recalcular la fecha de salida como la fecha de entrada más la cantidad de noches declarada cuando ambas discrepen y la cantidad de noches sea mayor que cero, porque en la planilla el total cobrado concuerda con la cantidad de noches y no con el intervalo de fechas.

#### Scenario: Noches y fechas discrepan
- **WHEN** una fila declara 3 noches pero sus fechas abarcan 2
- **THEN** el sistema registra la reserva con 3 noches, recalculando la fecha de salida, y anota el ajuste en el reporte

#### Scenario: Cantidad de noches en cero
- **WHEN** una fila declara 0 noches y sus fechas abarcan un intervalo válido
- **THEN** el sistema conserva las fechas y deriva de ellas la cantidad de noches

#### Scenario: Intervalo nulo o invertido sin corrección
- **WHEN** una fila queda con fecha de salida anterior o igual a la de entrada tras aplicar todas las reglas
- **THEN** el sistema rechaza esa fila y la incluye en el reporte

### Requirement: Reemplazo del valor por noche ausente
El sistema SHALL reemplazar todo valor por noche menor o igual a cero por la mediana de los valores por noche válidos de la misma pieza y el mismo año, y SHALL rechazar la fila si esa mediana no puede calcularse.

Este valor de relleno existe solo para satisfacer la integridad del modelo y no altera los ingresos, porque las filas afectadas son en su mayoría reservas canceladas, que no generan pago.

#### Scenario: Valor en cero reemplazado
- **WHEN** una fila cancelada del bloque 2025 declara un valor por noche de cero para una pieza chica
- **THEN** el sistema usa la mediana de los valores por noche de las piezas chicas de 2025 y marca la fila como corregida en el reporte

#### Scenario: Sin muestra para calcular la mediana
- **WHEN** no existe ninguna fila válida de esa pieza y año con valor por noche mayor que cero
- **THEN** el sistema rechaza la fila y la incluye en el reporte

### Requirement: Registro del monto real de cada reserva
El sistema SHALL usar el total neto declarado en la planilla como total de la reserva y como monto de su pago, sin recalcularlo a partir del valor por noche, y SHALL rechazar toda fila cuyo total neto resulte negativo tras aplicar las correcciones declaradas.

El total neto ya descuenta las comisiones de las plataformas, por lo que es el único valor que representa el ingreso efectivo.

#### Scenario: Total que no coincide con el producto de noches por valor
- **WHEN** una fila de Booking declara un total neto menor al producto de sus noches por su valor por noche, por efecto de la comisión
- **THEN** el sistema registra el total neto declarado como total de la reserva y monto del pago

#### Scenario: Total negativo sin corrección
- **WHEN** una fila declara un total neto negativo y no tiene una corrección explícita declarada
- **THEN** el sistema rechaza esa fila y la incluye en el reporte

### Requirement: Visibilidad de los ingresos históricos en el panel
El sistema SHALL registrar un pago por cada reserva pagada o pendiente, con la fecha de salida de la estadía como fecha de recepción, de modo que los reportes del panel administrativo, que agregan por pagos aprobados, reflejen los ingresos históricos reales.

#### Scenario: Ingresos por año visibles tras el import
- **WHEN** un administrador consulta el resumen del panel para un rango que cubre un año importado
- **THEN** el resumen muestra los ingresos de ese año provenientes de los pagos aprobados generados por el import

#### Scenario: Cobros pendientes vigentes
- **WHEN** un administrador consulta los cobros pendientes tras el import
- **THEN** aparecen las reservas importadas en estado pendiente, incluidas las estadías vigentes aún no pagadas

### Requirement: Huésped por reserva con datos mínimos sintetizados
El sistema SHALL crear un huésped por cada reserva importada a partir del nombre declarado en la planilla, separándolo en nombre y apellido, y SHALL sintetizar valores de contacto reconocibles como provenientes del import para los campos obligatorios que la planilla no provee.

#### Scenario: Nombre compuesto
- **WHEN** una fila declara un cliente con nombre y uno o más apellidos
- **THEN** el sistema registra el primer término como nombre y el resto como apellido

#### Scenario: Nombre de un solo término
- **WHEN** una fila declara un cliente con un único término
- **THEN** el sistema registra ese término como nombre y deja el apellido con un marcador reconocible del import

#### Scenario: Fila sin nombre de cliente
- **WHEN** una fila no declara nombre de cliente
- **THEN** el sistema rechaza esa fila y la incluye en el reporte

### Requirement: Limpieza previa de datos de prueba
El sistema SHALL eliminar la totalidad de las reservas, sus datos dependientes y las cotizaciones de empresa antes de insertar el historial, respetando el orden que imponen las restricciones de integridad referencial, y SHALL preservar el catálogo de habitaciones, sus imágenes, sus amenidades y las conexiones de canal.

Las conexiones de canal se preservan porque sus credenciales identifican los calendarios ya publicados en las plataformas externas.

#### Scenario: Limpieza completa
- **WHEN** el operador ejecuta el import en modo de escritura
- **THEN** el sistema elimina reservas, ítems, pagos, eventos de pago, huéspedes, retenciones, bloqueos de habitación, tareas de sincronización, alertas operacionales, notificaciones, interacciones del asistente, eventos de auditoría y cotizaciones de empresa

#### Scenario: Catálogo intacto
- **WHEN** finaliza la limpieza
- **THEN** las habitaciones, sus imágenes, sus amenidades y las conexiones de canal permanecen sin cambios

#### Scenario: Fallo durante la limpieza
- **WHEN** alguna eliminación falla por una restricción de integridad
- **THEN** el sistema revierte la operación completa y la base queda exactamente como estaba

### Requirement: Ejecución simulada por omisión
El sistema SHALL operar en modo simulado salvo que se solicite explícitamente la escritura, y en modo simulado SHALL producir el reporte completo sin borrar ni insertar nada.

#### Scenario: Ejecución sin solicitud de escritura
- **WHEN** el operador ejecuta el import sin la opción de confirmación de escritura
- **THEN** el sistema informa cuántas filas borraría e insertaría, con el desglose por año, estado y pieza, y no modifica la base

#### Scenario: Reporte de filas rechazadas
- **WHEN** finaliza una ejecución en cualquier modo
- **THEN** el sistema lista cada fila rechazada con su bloque, su número de fila en la planilla, el nombre del cliente y el motivo del rechazo

#### Scenario: Reporte de correcciones aplicadas
- **WHEN** finaliza una ejecución en cualquier modo
- **THEN** el sistema lista cada fila corregida indicando qué regla se aplicó y qué valor quedó registrado

### Requirement: Atomicidad e idempotencia del import
El sistema SHALL ejecutar la limpieza y la inserción completa dentro de una única transacción, y SHALL asignar a cada reserva un identificador público determinista derivado del bloque, la fila y el contenido de origen, de modo que una segunda ejecución no produzca reservas duplicadas.

#### Scenario: Fallo a mitad de la inserción
- **WHEN** falla la inserción de cualquier reserva, ítem o pago
- **THEN** el sistema revierte la transacción completa, incluida la limpieza, y la base queda con su contenido previo

#### Scenario: Segunda ejecución
- **WHEN** el import se ejecuta por segunda vez sobre la misma planilla
- **THEN** el sistema no crea reservas duplicadas, porque cada reserva conserva el mismo identificador público derivado de su fila de origen

#### Scenario: Identificador con formato válido
- **WHEN** el sistema genera el identificador público de una reserva importada
- **THEN** el identificador cumple el mismo formato que valida el sistema para las reservas creadas por los flujos existentes

### Requirement: Ejecución restringida a un entorno real y explícito
El sistema SHALL exigir una conexión de base de datos real y explícita para ejecutar, y SHALL negarse a operar contra una configuración de contexto simulado.

#### Scenario: Conexión ausente o simulada
- **WHEN** la conexión de base de datos no está definida o apunta a un valor de prueba
- **THEN** el sistema aborta antes de leer la planilla e informa qué variable de entorno falta
