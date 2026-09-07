## MODIFIED Requirements

### Requirement: Correos de cotización
El sistema SHALL generar un correo de confirmación para el cliente con el resumen y valores de la cotización, SHALL generar un correo operativo para Vista Valle con los datos necesarios para revisar la solicitud, y SHALL declarar explícitamente en ambos correos si la cotización cubre a todas las personas solicitadas.

#### Scenario: Confirmación al cliente
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** el cliente recibe un correo de Vista Valle SpA con fechas, personas, habitaciones, cantidades, precios por noche, noches, subtotales, total en CLP, si requiere estacionamiento y, cuando corresponda, la cantidad de desayunos, su precio unitario y su subtotal

#### Scenario: Notificación operativa
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** `ADMIN_NOTIFICATION_EMAIL` recibe el detalle de contacto, si la empresa requiere estacionamiento y snapshot completo de la cotización, incluyendo el desayuno cuando fue solicitado

#### Scenario: Identidad del remitente
- **WHEN** el sistema prepara cualquiera de los correos
- **THEN** usa `Vista Valle SpA <reservas@vistavalle.cl>` como identidad configurada del remitente

#### Scenario: Dominio aún no verificado
- **WHEN** el entorno no tiene un dominio habilitado para envío real
- **THEN** el sistema usa un transporte mock que renderiza y registra de forma segura los correos sin realizar llamadas externas, manteniendo el contrato compatible con Resend

#### Scenario: Cobertura parcial en el correo
- **WHEN** la capacidad de la cotización guardada es menor que la cantidad de personas solicitada
- **THEN** ambos correos indican explícitamente cuántas personas cubre la cotización frente a las solicitadas, sin presentarla como cobertura completa

## ADDED Requirements

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
