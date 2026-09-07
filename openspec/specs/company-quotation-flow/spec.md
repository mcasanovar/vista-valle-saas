# company-quotation-flow Specification

## Purpose

Permitir que empresas soliciten una cotización automática para múltiples habitaciones y reciban por correo un resumen calculado con valores transparentes, manteniendo una base segura para persistencia y entrega real.

## Requirements

### Requirement: Página dedicada de cotización empresarial
El sistema SHALL ofrecer la cotización empresarial en `/cotizacion-empresa` y SHALL mantener el landing limitado a la sección empresarial con su botón “Solicitar cotización”. Cuando la cotización empresarial esté habilitada, el CTA SHALL estar disponible también bajo el contexto productivo y SHALL navegar a la página dedicada, independientemente de que exista un canal genérico de contacto para empresas.

#### Scenario: Acceso desde el landing
- **WHEN** el visitante activa “Solicitar cotización” en el landing
- **THEN** el sistema navega a `/cotizacion-empresa` y no muestra el formulario completo dentro del landing

#### Scenario: CTA productivo sin canal genérico
- **WHEN** la cotización empresarial está habilitada en producción y no existe un canal genérico de contacto configurado
- **THEN** el landing mantiene visible el CTA “Solicitar cotización” y lo dirige a `/cotizacion-empresa`

#### Scenario: Apertura directa
- **WHEN** el visitante abre `/cotizacion-empresa` directamente
- **THEN** el sistema presenta una página pública con navegación, contexto de la cotización, formulario y pie de página consistentes con Vista Valle

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

### Requirement: Selector de estacionamiento
El sistema SHALL solicitar en el formulario de datos de empresa si la empresa requiere estacionamiento mediante un selector booleano Sí/No, sin aceptar texto libre, SHALL exigir una respuesta explícita antes de enviar la cotización, y SHALL persistir la respuesta en la cotización.

#### Scenario: Selección de estacionamiento
- **WHEN** el visitante completa el formulario de datos de empresa
- **THEN** el sistema presenta un selector Sí/No para "¿Requiere estacionamiento?" en lugar de un campo de texto libre

#### Scenario: Estacionamiento sin responder
- **WHEN** el visitante intenta enviar la cotización sin seleccionar una opción de estacionamiento
- **THEN** el sistema marca el campo como obligatorio y no envía la cotización

#### Scenario: Persistencia de la respuesta
- **WHEN** la cotización se guarda correctamente
- **THEN** el sistema conserva si la empresa requiere estacionamiento como parte de la cotización registrada

### Requirement: Selector y detalle de desayunos
El sistema SHALL ofrecer en el formulario un selector booleano "¿Desea desayunos?" con valor por defecto "No". Cuando el visitante seleccione "No", el resto del flujo SHALL continuar sin cambios y el sistema SHALL registrar la solicitud de desayuno como no solicitada. Cuando el visitante seleccione "Sí", el sistema SHALL mostrar un bloque con la descripción vigente de lo que incluye el desayuno, su precio unitario en CLP y un campo numérico obligatorio para indicar la cantidad de desayunos deseados, ambos obtenidos del catálogo de desayuno administrable.

#### Scenario: Desayuno no solicitado
- **WHEN** el visitante deja o selecciona "No" en "¿Desea desayunos?"
- **THEN** el sistema no muestra el bloque de detalle de desayuno y registra la cotización sin desayuno

#### Scenario: Desayuno solicitado
- **WHEN** el visitante selecciona "Sí" en "¿Desea desayunos?"
- **THEN** el sistema despliega la descripción vigente del desayuno, su precio unitario en CLP y un campo numérico para la cantidad deseada

#### Scenario: Cantidad de desayunos inválida
- **WHEN** el visitante selecciona "Sí" pero indica una cantidad de desayunos ausente, cero, negativa o fraccionaria
- **THEN** el sistema marca el campo como obligatorio y no envía la cotización

### Requirement: Cálculo autoritativo de cotización
El sistema SHALL calcular noches, precio por noche, subtotales y total en el servidor usando habitaciones activas, precios y capacidades autorizados, y SHALL conservar el detalle calculado como snapshot de la cotización.

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

### Requirement: Cálculo y snapshot del desayuno en la cotización
El sistema SHALL calcular, en el servidor, el subtotal del desayuno como la cantidad solicitada multiplicada por el precio unitario vigente del catálogo de desayuno al momento de la cotización, SHALL sumar ese subtotal al total de la cotización cuando el desayuno fue solicitado, y SHALL conservar como snapshot la cantidad, el precio unitario y el subtotal del desayuno usados en el cálculo, de forma que cambios posteriores en el precio del catálogo no alteren cotizaciones ya guardadas.

#### Scenario: Total con desayuno incluido
- **WHEN** una cotización válida solicita desayuno con una cantidad determinada
- **THEN** el sistema calcula el subtotal del desayuno con el precio unitario vigente del catálogo y lo incluye en el total de la cotización

#### Scenario: Total sin desayuno
- **WHEN** una cotización válida no solicita desayuno
- **THEN** el sistema calcula el total sin ningún monto de desayuno

#### Scenario: Precio del catálogo cambia después de emitida la cotización
- **WHEN** el precio del desayuno en el catálogo cambia después de que una cotización con desayuno fue guardada
- **THEN** la cotización registrada conserva el precio unitario y el subtotal de desayuno con los que fue calculada originalmente

### Requirement: Persistencia preparada para PostgreSQL
El sistema SHALL guardar la solicitud, sus líneas, datos de contacto y snapshot de precios, capacidades, noches y total mediante un contrato de persistencia que permita usar PostgreSQL como fuente durable.

#### Scenario: Creación de solicitud
- **WHEN** la cotización supera las validaciones y el envío es aceptado
- **THEN** el sistema registra una solicitud identificable con sus líneas de habitación y valores calculados

#### Scenario: Reutilización posterior de datos
- **WHEN** cambian posteriormente el nombre, capacidad o precio de una habitación
- **THEN** la cotización registrada conserva los valores snapshot con los que fue calculada

#### Scenario: Persistencia no disponible
- **WHEN** el repositorio no puede guardar la solicitud
- **THEN** el sistema no confirma la cotización como enviada y comunica un error recuperable sin exponer detalles internos

### Requirement: Correos de cotización
El sistema SHALL generar un correo de confirmación para el cliente con el resumen y valores de la cotización, SHALL generar un correo operativo para Vista Valle con los datos necesarios para revisar la solicitud, SHALL declarar explícitamente en ambos correos si la cotización cubre a todas las personas solicitadas y SHALL indicar al cliente que debe responder al mismo correo confirmando los días cotizados para que Vista Valle pueda generar la reserva.

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
- **THEN** usa la identidad configurada del remitente (`RESEND_FROM_NAME <RESEND_FROM_EMAIL>`, con `Vista Valle SpA <reservas@vistavalle.cl>` como valor de producción) o una dirección de respuesta operativa equivalente

#### Scenario: Dominio aún no verificado
- **WHEN** el entorno no tiene un dominio habilitado para envío real
- **THEN** el sistema usa un transporte mock que renderiza y registra de forma segura los correos sin realizar llamadas externas, manteniendo el contrato compatible con Resend

#### Scenario: Cobertura parcial en el correo
- **WHEN** la capacidad de la cotización guardada es menor que la cantidad de personas solicitada
- **THEN** ambos correos indican explícitamente cuántas personas cubre la cotización frente a las solicitadas, sin presentarla como cobertura completa

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

### Requirement: Entrega idempotente y estados recuperables
El sistema SHALL evitar correos duplicados para una misma solicitud y SHALL conservar estados de entrega, errores seguros y reintentos para fallos transitorios.

#### Scenario: Reintento de la misma solicitud
- **WHEN** una solicitud o evento de entrega se procesa más de una vez
- **THEN** el sistema conserva una sola cotización y no duplica las notificaciones asociadas

#### Scenario: Fallo transitorio de correo
- **WHEN** el proveedor de correo devuelve un fallo transitorio
- **THEN** el sistema registra un estado reintentable sin exponer datos personales en logs

#### Scenario: Fallo permanente
- **WHEN** el proveedor devuelve un fallo permanente o la plantilla no puede construirse con datos válidos
- **THEN** el sistema marca la entrega como fallida, conserva la solicitud y muestra un estado recuperable al usuario

### Requirement: Experiencia accesible y segura
La página SHALL mantener labels visibles, validación asociada a campos, foco identificable, controles táctiles accesibles, resumen comprensible y protección de secretos y datos personales.

#### Scenario: Operación con teclado
- **WHEN** el visitante completa la solicitud sin ratón
- **THEN** puede modificar fechas, personas, cantidades y enviar el formulario siguiendo un orden de foco visible

#### Scenario: Datos sensibles
- **WHEN** el sistema registra o reporta una solicitud
- **THEN** mantiene las credenciales server-only y evita incluir correo, teléfono o mensaje completo en logs operativos
