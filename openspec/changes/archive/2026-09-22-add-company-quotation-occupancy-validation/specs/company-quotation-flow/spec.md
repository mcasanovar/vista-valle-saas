## MODIFIED Requirements

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
- **WHEN** existen habitaciones libres para el rango consultado, pero su capacidad sumada (respetando el máximo de una unidad por tipo) no alcanza para la cantidad de personas solicitada
- **THEN** el sistema informa cuántas habitaciones están disponibles, para cuántas personas y cuánta capacidad falta, indica que no es posible completar una cotización para el total solicitado con la disponibilidad actual, y no muestra el formulario de selección

#### Scenario: Disponibilidad nula
- **WHEN** ninguna habitación activa está libre para el rango consultado
- **THEN** el sistema informa que no hay habitaciones disponibles para esas fechas y no muestra el formulario de selección

#### Scenario: Nueva consulta de fechas
- **WHEN** el visitante modifica las fechas o la cantidad de personas después de obtener un resultado de disponibilidad
- **THEN** el sistema vuelve a resolver disponibilidad para los nuevos criterios y reemplaza el mensaje y el formulario mostrados según corresponda

### Requirement: Selección de habitaciones y capacidad visible
El sistema SHALL permitir indicar la cantidad total de personas y, para cada tipo de habitación con al menos una unidad disponible en las fechas consultadas, seleccionarla e indicar cuántas de las personas del total se alojarán en ella, sin permitir más de una unidad seleccionada por tipo aunque existan varias unidades disponibles. El sistema SHALL impedir asignar a una habitación una cantidad de personas mayor que su capacidad máxima, SHALL impedir asignar en total más personas que el total indicado para la cotización, SHALL mostrar en todo momento cuántas personas han sido asignadas frente al total, y SHALL mantener deshabilitado el envío de la cotización mientras la suma de personas asignadas en las habitaciones seleccionadas sea distinta del total indicado.

#### Scenario: Capacidades mock iniciales
- **WHEN** el visitante consulta las opciones de habitación
- **THEN** el sistema muestra Individual con capacidad máxima de 1 persona, Matrimonial con capacidad máxima de 1 persona y Doble con capacidad máxima de 2 personas

#### Scenario: Selección mediante botón
- **WHEN** el visitante activa el botón "Seleccionar" de una habitación disponible
- **THEN** el sistema la marca como seleccionada, muestra un control para indicar cuántas personas se alojarán en ella (hasta su capacidad máxima) y permite revertir la selección activando el botón de nuevo

#### Scenario: Máximo una unidad por tipo
- **WHEN** un tipo de habitación tiene más de una unidad disponible para las fechas consultadas
- **THEN** el sistema permite seleccionar como máximo una unidad de ese tipo por cotización

#### Scenario: Bloqueo por capacidad de la habitación
- **WHEN** el visitante intenta asignar a una habitación seleccionada una cantidad de personas mayor que su capacidad máxima
- **THEN** el sistema impide la asignación y no permite superar la capacidad de esa habitación

#### Scenario: Bloqueo al completar el total
- **WHEN** la suma de personas asignadas en las habitaciones seleccionadas alcanza el total de personas de la cotización
- **THEN** el sistema bloquea el aumento de personas en cualquier habitación seleccionada y bloquea la selección de habitaciones adicionales, hasta que se libere capacidad reduciendo la asignación de alguna habitación

#### Scenario: Remanente disponible para cualquier habitación
- **WHEN** la suma de personas asignadas es menor que el total de personas de la cotización
- **THEN** el sistema permite asignar el remanente de personas a cualquiera de las habitaciones seleccionadas que aún tenga capacidad disponible

#### Scenario: Capacidad suficiente
- **WHEN** la suma de personas asignadas en las habitaciones seleccionadas es exactamente igual al total de personas de la cotización
- **THEN** el sistema indica que la distribución está completa y permite continuar

#### Scenario: Capacidad insuficiente
- **WHEN** la suma de personas asignadas en las habitaciones seleccionadas es menor que el total de personas de la cotización
- **THEN** el sistema indica cuánta capacidad falta por asignar y no permite enviar la cotización mientras falte

#### Scenario: Cantidades inválidas
- **WHEN** una solicitud indica cantidades de personas por habitación negativas, fraccionarias o no válidas (por ejemplo, enviadas directamente a la API sin pasar por el control de asignación)
- **THEN** el sistema marca el campo correspondiente y no calcula ni envía una cotización válida

### Requirement: Cálculo autoritativo de cotización
El sistema SHALL calcular noches, precio por noche, subtotales y total en el servidor usando habitaciones activas, precios y capacidades autorizados, SHALL conservar el detalle calculado como snapshot de la cotización, y SHALL rechazar la solicitud si alguna línea de habitación excede su capacidad autorizada o si la suma de personas asignadas por habitación no es exactamente igual al total de personas de la solicitud.

#### Scenario: Cotización de múltiples tipos
- **WHEN** una empresa solicita fechas válidas, personas y cantidades de varios tipos de habitación cuya distribución de personas suma exactamente el total solicitado
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

#### Scenario: Línea excede la capacidad de la habitación
- **WHEN** una línea de la solicitud asigna a una habitación una cantidad de personas mayor que su capacidad autorizada
- **THEN** el sistema rechaza la solicitud con un error específico y no genera una cotización

#### Scenario: Distribución de personas incompleta o excedida
- **WHEN** la suma de personas asignadas por habitación en la solicitud es distinta al total de personas indicado
- **THEN** el sistema rechaza la solicitud con un error específico y no genera una cotización parcial

### Requirement: Correos de cotización
El sistema SHALL generar un correo de confirmación para el cliente con el resumen y valores de la cotización y SHALL generar un correo operativo para Vista Valle con los datos necesarios para revisar la solicitud. Dado que toda cotización guardada cubre exactamente el total de personas solicitado, el sistema SHALL indicar al cliente que debe responder al mismo correo confirmando los días cotizados para que Vista Valle pueda generar la reserva.

#### Scenario: Confirmación al cliente
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** el cliente recibe un correo de Vista Valle SpA con fechas, personas, habitaciones, cantidades, precios por noche, noches, subtotales, total en CLP, si requiere estacionamiento y, cuando corresponda, la cantidad de desayunos, su precio unitario y su subtotal

#### Scenario: Instrucción de confirmación
- **WHEN** el cliente recibe el correo de su cotización
- **THEN** el correo muestra un bloque destacado que indica que debe responder al mismo correo confirmando los días cotizados y que la respuesta es necesaria para generar la reserva

#### Scenario: La cotización no crea una reserva automáticamente
- **WHEN** una cotización se guarda y sus correos se entregan
- **THEN** el sistema no crea ni presenta una reserva confirmada; la reserva queda pendiente de la confirmación recibida por correo y de la gestión operativa de Vista Valle

#### Scenario: Notificación operativa
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** `ADMIN_NOTIFICATION_EMAIL` recibe el detalle de contacto, si la empresa requiere estacionamiento y snapshot completo de la cotización, incluyendo el desayuno cuando fue solicitado

#### Scenario: Identidad del remitente
- **WHEN** el sistema prepara cualquiera de los correos
- **THEN** usa la identidad configurada del remitente (`RESEND_FROM_NAME <RESEND_FROM_EMAIL>`, con `Vista Valle SpA <reservas@vistavallehospedaje.com>` como valor de producción) o una dirección de respuesta operativa equivalente

#### Scenario: Dominio aún no verificado
- **WHEN** el entorno no tiene un dominio habilitado para envío real
- **THEN** el sistema usa un transporte mock que renderiza y registra de forma segura los correos sin realizar llamadas externas, manteniendo el contrato compatible con Resend

#### Scenario: Cobertura parcial en el correo
- **WHEN** una cotización se guarda correctamente
- **THEN** ninguno de los dos correos menciona cobertura parcial, porque la validación de distribución de personas ya garantizó que la cotización cubre exactamente el total de personas solicitado

