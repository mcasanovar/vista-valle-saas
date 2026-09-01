## ADDED Requirements

### Requirement: Verificación de disponibilidad previa al formulario
El sistema SHALL solicitar primero la fecha de entrada, la fecha de salida y la cantidad total de personas, SHALL resolver la disponibilidad real de habitaciones para ese rango antes de habilitar la selección de habitaciones, y SHALL informar siempre la cantidad de habitaciones disponibles y la capacidad total que representan, sin importar si la disponibilidad es total, parcial o nula.

#### Scenario: Fechas y personas inválidas
- **WHEN** el visitante intenta continuar con fechas ausentes, inválidas o no ordenadas, o con una cantidad de personas fuera de los límites permitidos
- **THEN** el sistema no consulta disponibilidad, identifica los campos a corregir y no muestra el formulario de selección

#### Scenario: Disponibilidad total
- **WHEN** todas las habitaciones activas están libres para el rango consultado y su capacidad sumada alcanza para la cantidad de personas
- **THEN** el sistema informa que todas las habitaciones están disponibles junto con la capacidad total y muestra el formulario de selección habilitado para esas habitaciones

#### Scenario: Disponibilidad parcial suficiente
- **WHEN** solo una parte de las habitaciones activas está libre para el rango consultado, pero su capacidad sumada alcanza para la cantidad de personas
- **THEN** el sistema informa cuántas habitaciones están disponibles y para cuántas personas, y muestra el formulario de selección acotado a esas habitaciones

#### Scenario: Disponibilidad parcial insuficiente
- **WHEN** existen habitaciones libres para el rango consultado, pero su capacidad sumada no alcanza para la cantidad de personas solicitada
- **THEN** el sistema informa cuántas habitaciones están disponibles, para cuántas personas y cuánta capacidad falta, y muestra el formulario de selección acotado a esas habitaciones permitiendo continuar con una cotización parcial

#### Scenario: Disponibilidad nula
- **WHEN** ninguna habitación activa está libre para el rango consultado
- **THEN** el sistema informa que no hay habitaciones disponibles para esas fechas y no muestra el formulario de selección

#### Scenario: Nueva consulta de fechas
- **WHEN** el visitante modifica las fechas o la cantidad de personas después de obtener un resultado de disponibilidad
- **THEN** el sistema vuelve a resolver disponibilidad para los nuevos criterios y reemplaza el mensaje y el formulario mostrados según corresponda

### Requirement: Confirmación de envío mediante modal
El sistema SHALL mostrar un modal de confirmación cuando la cotización se envíe exitosamente, SHALL omitir montos, habitaciones y cantidades en ese modal, SHALL mostrar en el modal un contador visible con los segundos restantes hasta el cierre automático, actualizado cada segundo, SHALL permitir cerrarlo mediante un botón, un clic fuera del modal o la tecla Escape, SHALL cerrarlo automáticamente cuando el contador llegue a cero, y SHALL redirigir a la página de inicio del sitio cada vez que el modal se cierre, sin importar el medio de cierre.

#### Scenario: Envío exitoso
- **WHEN** la cotización se envía exitosamente
- **THEN** el sistema muestra un modal de confirmación indicando que la cotización fue enviada al correo del usuario, sin mostrar habitaciones, cantidades ni montos

#### Scenario: Contador visible
- **WHEN** el modal de confirmación está abierto
- **THEN** el sistema muestra un contador que indica cuántos segundos faltan para el cierre automático y lo actualiza cada segundo hasta llegar a cero

#### Scenario: Cierre mediante botón
- **WHEN** el visitante activa el botón de cierre del modal
- **THEN** el sistema cierra el modal y redirige a la página de inicio

#### Scenario: Cierre mediante clic en el fondo
- **WHEN** el visitante hace clic fuera del contenido del modal
- **THEN** el sistema cierra el modal y redirige a la página de inicio

#### Scenario: Cierre mediante tecla Escape
- **WHEN** el visitante presiona Escape mientras el modal está abierto
- **THEN** el sistema cierra el modal y redirige a la página de inicio

#### Scenario: Cierre automático por temporizador
- **WHEN** transcurren 5 segundos desde que se muestra el modal sin que el visitante lo cierre antes
- **THEN** el sistema cierra el modal y redirige a la página de inicio

## MODIFIED Requirements

### Requirement: Selección de habitaciones y capacidad visible
El sistema SHALL permitir indicar la cantidad total de personas y, para cada tipo de habitación con al menos una unidad disponible en las fechas consultadas, seleccionarla mediante un botón, sin permitir más de una unidad seleccionada por tipo aunque existan varias unidades disponibles; SHALL mostrar la capacidad máxima de cada habitación y la cantidad de unidades disponibles para esas fechas antes del envío; y SHALL validar que la capacidad acumulada seleccionada represente el total real de lo elegido, sin dejar de advertir cuando sea menor a lo necesario.

#### Scenario: Capacidades mock iniciales
- **WHEN** el visitante consulta las opciones de habitación
- **THEN** el sistema muestra Individual con capacidad máxima de 1 persona, Matrimonial con capacidad máxima de 1 persona y Doble con capacidad máxima de 2 personas

#### Scenario: Selección mediante botón
- **WHEN** el visitante activa el botón "Seleccionar" de una habitación disponible
- **THEN** el sistema la marca como seleccionada, cambia el botón a un estado "Seleccionado" y permite revertir la selección activándolo de nuevo

#### Scenario: Máximo una unidad por tipo
- **WHEN** un tipo de habitación tiene más de una unidad disponible para las fechas consultadas
- **THEN** el sistema permite seleccionar como máximo una unidad de ese tipo por cotización

#### Scenario: Capacidad suficiente
- **WHEN** la cantidad total de personas es menor o igual a la capacidad sumada de las habitaciones disponibles solicitadas
- **THEN** el sistema indica que la capacidad es suficiente y permite continuar

#### Scenario: Capacidad insuficiente
- **WHEN** la cantidad total de personas supera la capacidad sumada de las habitaciones disponibles solicitadas
- **THEN** el sistema indica cuánta capacidad falta, identifica el ajuste necesario y permite enviar una cotización parcial sobre lo seleccionado sin presentarla como cobertura completa

#### Scenario: Cantidades inválidas
- **WHEN** una solicitud indica cantidades de habitaciones negativas, fraccionarias o no válidas (por ejemplo, enviadas directamente a la API sin pasar por el botón de selección)
- **THEN** el sistema marca el campo correspondiente y no calcula ni envía una cotización válida

### Requirement: Cálculo autoritativo de cotización
El sistema SHALL calcular noches, precio por noche, subtotales y total en el servidor usando habitaciones activas, precios, capacidades y disponibilidad autorizados para las fechas solicitadas, y SHALL conservar el detalle calculado como snapshot de la cotización.

#### Scenario: Cotización de múltiples tipos
- **WHEN** una empresa solicita fechas válidas, personas y cantidades de varios tipos de habitación
- **THEN** el sistema calcula cada subtotal como cantidad por precio nocturno por noches y calcula el total como la suma de los subtotales

#### Scenario: Datos manipulados por el cliente
- **WHEN** el cliente altera precios, subtotales, noches o total en la petición
- **THEN** el sistema ignora esos valores y recalcula la cotización con sus propias fuentes autorizadas

#### Scenario: Fechas inválidas
- **WHEN** la entrada, salida o intervalo no representa fechas de alojamiento válidas
- **THEN** el sistema rechaza la solicitud con un error específico y no genera una cotización

#### Scenario: Disponibilidad insuficiente al momento del envío
- **WHEN** al recibir el envío, una o más líneas solicitan más unidades de un tipo de habitación que las que están libres en el servidor para esas fechas al momento de procesar la solicitud
- **THEN** el sistema rechaza esas líneas con un error específico, indica la disponibilidad vigente y no genera una cotización que las incluya

### Requirement: Correos de cotización
El sistema SHALL generar un correo de confirmación para el cliente con el resumen y valores de la cotización, SHALL generar un correo operativo para Vista Valle con los datos necesarios para revisar la solicitud, y SHALL declarar explícitamente en ambos correos si la cotización cubre a todas las personas solicitadas.

#### Scenario: Confirmación al cliente
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** el cliente recibe un correo de Vista Valle SpA con fechas, personas, habitaciones, cantidades, precios por noche, noches, subtotales y total en CLP

#### Scenario: Notificación operativa
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** `ADMIN_NOTIFICATION_EMAIL` recibe el detalle de contacto, requisitos y snapshot completo de la cotización

#### Scenario: Identidad del remitente
- **WHEN** el sistema prepara cualquiera de los correos
- **THEN** usa `Vista Valle SpA <reservas@vistavalle.cl>` como identidad configurada del remitente

#### Scenario: Dominio aún no verificado
- **WHEN** el entorno no tiene un dominio habilitado para envío real
- **THEN** el sistema usa un transporte mock que renderiza y registra de forma segura los correos sin realizar llamadas externas, manteniendo el contrato compatible con Resend

#### Scenario: Cobertura parcial en el correo
- **WHEN** la capacidad de la cotización guardada es menor que la cantidad de personas solicitada
- **THEN** ambos correos indican explícitamente cuántas personas cubre la cotización frente a las solicitadas, sin presentarla como cobertura completa
