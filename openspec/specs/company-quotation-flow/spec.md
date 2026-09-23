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

### Requirement: Progreso de pasos con panel único visible y retroceso mediante un único botón
El sistema SHALL organizar `/cotizacion-empresa` en tres pasos (Fechas y personas, Habitaciones, Datos de empresa y desayunos) mostrados mediante un indicador de progreso persistente, y SHALL mostrar en cada momento el panel de un solo paso a la vez: el contenido de un paso ya completado SHALL dejar de mostrarse en pantalla mientras el visitante permanece en un paso posterior. El sistema SHALL ofrecer un único control "Atrás", ubicado inmediatamente debajo del indicador de progreso, que retrocede al paso inmediatamente anterior conservando la información ya ingresada en él; este control SHALL estar ausente en el primer paso y SHALL ser el único medio de retroceso (sin controles adicionales de "editar" específicos de cada paso).

#### Scenario: Un solo panel visible
- **WHEN** el visitante avanza del paso de habitaciones al paso de datos de empresa
- **THEN** el sistema deja de mostrar el panel de selección de habitaciones y muestra únicamente el panel de datos de empresa y desayunos

#### Scenario: Retroceder con el botón Atrás
- **WHEN** el visitante activa el botón "Atrás" ubicado debajo del indicador de progreso
- **THEN** el sistema vuelve a mostrar el panel del paso inmediatamente anterior con la información ya ingresada, oculta el panel del paso del que retrocede, y actualiza el indicador de progreso para reflejar el paso anterior

#### Scenario: Sin botón Atrás en el primer paso
- **WHEN** el visitante está en el primer paso del flujo (Fechas y personas)
- **THEN** el sistema no muestra el botón "Atrás"

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
El sistema SHALL permitir indicar la cantidad total de personas y, para cada tipo de habitación con al menos una unidad disponible en las fechas consultadas, elegirla para configurar cuántas de las personas del total se alojarían en ella, sin permitir más de una unidad configurada o agregada por tipo aunque existan varias unidades disponibles. El sistema SHALL impedir configurar o agregar a una habitación una cantidad de personas mayor que su capacidad máxima, y SHALL impedir que la suma de personas agregadas en las habitaciones supere el total indicado para la cotización.

#### Scenario: Capacidades mock iniciales
- **WHEN** el visitante consulta las opciones de habitación
- **THEN** el sistema muestra Individual con capacidad máxima de 1 persona, Matrimonial con capacidad máxima de 1 persona y Doble con capacidad máxima de 2 personas

#### Scenario: Selección mediante botón
- **WHEN** el visitante activa el botón "Elegir" de una habitación disponible
- **THEN** el sistema la marca como en configuración y muestra un control para indicar cuántas personas se alojarán en ella (hasta su capacidad máxima), sin sumarla todavía al total asignado

#### Scenario: Máximo una unidad por tipo
- **WHEN** un tipo de habitación tiene más de una unidad disponible para las fechas consultadas
- **THEN** el sistema permite configurar o agregar como máximo una unidad de ese tipo por cotización

#### Scenario: Bloqueo por capacidad de la habitación
- **WHEN** el visitante intenta configurar en una habitación una cantidad de personas mayor que su capacidad máxima
- **THEN** el sistema impide la selección de esa cantidad y no permite superar la capacidad de esa habitación

#### Scenario: Bloqueo al completar el total
- **WHEN** la suma de personas agregadas en las habitaciones alcanza el total de personas de la cotización
- **THEN** el sistema bloquea la posibilidad de configurar cantidades adicionales en cualquier habitación y bloquea elegir habitaciones adicionales, hasta que se libere capacidad quitando alguna habitación agregada

#### Scenario: Remanente disponible para cualquier habitación
- **WHEN** la suma de personas agregadas es menor que el total de personas de la cotización
- **THEN** el sistema permite configurar el remanente de personas en cualquiera de las habitaciones que aún no estén agregadas y tengan capacidad disponible

#### Scenario: Capacidad suficiente
- **WHEN** la suma de personas agregadas en las habitaciones es exactamente igual al total de personas de la cotización
- **THEN** el sistema habilita el botón "Continuar" para avanzar al paso de datos de empresa

#### Scenario: Capacidad insuficiente
- **WHEN** la suma de personas agregadas en las habitaciones es menor que el total de personas de la cotización
- **THEN** el sistema mantiene deshabilitado el botón "Continuar" y no muestra el paso de datos de empresa

#### Scenario: Cantidades inválidas
- **WHEN** una solicitud indica cantidades de personas por habitación negativas, fraccionarias o no válidas (por ejemplo, enviadas directamente a la API sin pasar por el control de asignación)
- **THEN** el sistema marca el campo correspondiente y no calcula ni envía una cotización válida

### Requirement: Confirmación explícita de habitación mediante selección de personas y agregado
Al elegir una habitación disponible, el sistema SHALL mostrar primero un selector para indicar cuántas personas se alojarán en ella sin contarla todavía en el total asignado, y SHALL requerir que el visitante confirme una acción explícita "Agregar habitación" para que esa cantidad pase a formar parte del total asignado. El sistema SHALL permitir cancelar la configuración de una habitación antes de confirmarla, sin afectar el total asignado, y SHALL permitir quitar una habitación ya agregada, devolviendo su cantidad al total disponible para asignar.

#### Scenario: Elegir una habitación abre el selector sin asignarla
- **WHEN** el visitante elige una habitación disponible que no está configurada ni agregada
- **THEN** el sistema muestra el selector de cantidad de personas para esa habitación sin sumarla todavía al total asignado

#### Scenario: Confirmar agrega la habitación
- **WHEN** el visitante elige una cantidad de personas para una habitación en configuración y activa "Agregar habitación"
- **THEN** el sistema suma esa cantidad al total asignado y muestra la habitación como agregada

#### Scenario: Cancelar no asigna
- **WHEN** el visitante cancela la configuración de una habitación antes de confirmarla
- **THEN** el sistema no suma ninguna cantidad de esa habitación al total asignado y la vuelve a mostrar como disponible para elegir

#### Scenario: Quitar una habitación agregada
- **WHEN** el visitante quita una habitación ya agregada
- **THEN** el sistema resta su cantidad del total asignado y la vuelve a mostrar como disponible para elegir

### Requirement: Progreso visual de personas asignadas
El sistema SHALL mostrar el progreso de personas asignadas frente al total mediante un indicador visual de puntos o avatares que se llenan a medida que se agregan habitaciones, en lugar de depender de una oración como único medio de comunicarlo, y SHALL mantener un texto accesible equivalente para tecnologías de asistencia que se actualice junto con el indicador visual.

#### Scenario: Indicador visual de progreso
- **WHEN** el visitante agrega o quita una habitación
- **THEN** el sistema actualiza el indicador visual de puntos para reflejar cuántas personas del total ya están asignadas

#### Scenario: Equivalente accesible
- **WHEN** el indicador visual de progreso cambia
- **THEN** el sistema expone un texto accesible equivalente (por ejemplo "4 de 6 personas asignadas") para tecnologías de asistencia

### Requirement: Avance explícito al paso de datos de empresa
El sistema SHALL mostrar en el paso de habitaciones un botón "Continuar" que SHALL permanecer deshabilitado mientras el total de personas agregadas sea distinto del total de la cotización, y SHALL avanzar al paso de datos de empresa y desayunos únicamente cuando el visitante lo active con la asignación completa.

#### Scenario: Continuar deshabilitado
- **WHEN** el total de personas agregadas es distinto del total de la cotización
- **THEN** el botón "Continuar" permanece deshabilitado y el paso de datos de empresa no se muestra

#### Scenario: Continuar habilitado y avance
- **WHEN** el total de personas agregadas es exactamente igual al total de la cotización y el visitante activa "Continuar"
- **THEN** el sistema muestra el paso de datos de empresa y desayunos y oculta el panel de habitaciones

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
El sistema SHALL ofrecer, en el paso de datos de empresa y desayunos, un selector booleano "¿Desea desayunos?" con valor por defecto "No". Cuando el visitante seleccione "No", el resto del flujo SHALL continuar sin cambios y el sistema SHALL registrar la solicitud de desayuno como no solicitada. Cuando el visitante seleccione "Sí", el sistema SHALL mostrar un bloque con la descripción vigente de lo que incluye el desayuno, su precio unitario en CLP, un campo numérico obligatorio para indicar la cantidad de desayunos deseados por noche (obtenidos del catálogo de desayuno administrable), y un texto de ayuda persistente junto al campo que explique que esa cantidad se multiplicará por la cantidad de noches de la estadía para calcular el total del servicio.

#### Scenario: Desayuno no solicitado
- **WHEN** el visitante deja o selecciona "No" en "¿Desea desayunos?"
- **THEN** el sistema no muestra el bloque de detalle de desayuno y registra la cotización sin desayuno

#### Scenario: Desayuno solicitado
- **WHEN** el visitante selecciona "Sí" en "¿Desea desayunos?"
- **THEN** el sistema despliega la descripción vigente del desayuno, su precio unitario en CLP, un campo numérico para la cantidad deseada por noche y el texto de ayuda sobre la multiplicación por noches

#### Scenario: Cantidad de desayunos inválida
- **WHEN** el visitante selecciona "Sí" pero indica una cantidad de desayunos por noche ausente, cero, negativa o fraccionaria
- **THEN** el sistema marca el campo como obligatorio y no envía la cotización

#### Scenario: Texto de ayuda sobre el cálculo del desayuno
- **WHEN** el visitante ve el campo de cantidad de desayunos por noche en el paso de datos de empresa
- **THEN** el sistema muestra junto al campo, sin necesidad de interacción adicional, la explicación de que el total de desayunos se calcula multiplicando esa cantidad por noche por la cantidad de noches de la estadía

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

### Requirement: Cálculo y snapshot del desayuno en la cotización
El sistema SHALL calcular, en el servidor, el subtotal del desayuno como la cantidad solicitada por noche multiplicada por el precio unitario vigente del catálogo de desayuno y por la cantidad de noches de la cotización, SHALL sumar ese subtotal al total de la cotización cuando el desayuno fue solicitado, y SHALL conservar como snapshot la cantidad por noche, el precio unitario y el subtotal del desayuno usados en el cálculo, de forma que cambios posteriores en el precio del catálogo no alteren cotizaciones ya guardadas.

#### Scenario: Total con desayuno incluido
- **WHEN** una cotización válida solicita desayuno con una cantidad por noche determinada
- **THEN** el sistema calcula el subtotal del desayuno como esa cantidad por el precio unitario vigente del catálogo por la cantidad de noches, y lo incluye en el total de la cotización

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
