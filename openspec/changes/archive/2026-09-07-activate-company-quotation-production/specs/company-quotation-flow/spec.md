## MODIFIED Requirements

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

### Requirement: Correos de cotización
El sistema SHALL generar un correo de confirmación para el cliente con el resumen y valores de la cotización, SHALL generar un correo operativo para Vista Valle con los datos necesarios para revisar la solicitud, SHALL declarar explícitamente en ambos correos si la cotización cubre a todas las personas solicitadas y SHALL indicar al cliente que debe responder al mismo correo confirmando los días cotizados para que Vista Valle pueda generar la reserva.

#### Scenario: Confirmación al cliente
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** el cliente recibe un correo de Vista Valle SpA con fechas, personas, habitaciones, cantidades, precios por noche, noches, subtotales y total en CLP

#### Scenario: Instrucción de confirmación
- **WHEN** el cliente recibe el correo de su cotización
- **THEN** el correo muestra un bloque destacado que indica que debe responder al mismo correo confirmando los días cotizados y que la respuesta es necesaria para generar la reserva

#### Scenario: La cotización no crea una reserva automáticamente
- **WHEN** una cotización se guarda y sus correos se entregan
- **THEN** el sistema no crea ni presenta una reserva confirmada; la reserva queda pendiente de la confirmación recibida por correo y de la gestión operativa de Vista Valle

#### Scenario: Notificación operativa
- **WHEN** una solicitud válida se guarda correctamente
- **THEN** `ADMIN_NOTIFICATION_EMAIL` recibe el detalle de contacto, requisitos y snapshot completo de la cotización

#### Scenario: Identidad del remitente
- **WHEN** el sistema prepara cualquiera de los correos
- **THEN** usa `Vista Valle SpA <reservas@vistavalle.cl>` como identidad configurada del remitente o como dirección de respuesta operativa equivalente

#### Scenario: Dominio aún no verificado
- **WHEN** el entorno no tiene un dominio habilitado para envío real
- **THEN** el sistema usa un transporte mock que renderiza y registra de forma segura los correos sin realizar llamadas externas, manteniendo el contrato compatible con Resend

#### Scenario: Cobertura parcial en el correo
- **WHEN** la capacidad de la cotización guardada es menor que la cantidad de personas solicitada
- **THEN** ambos correos indican explícitamente cuántas personas cubre la cotización frente a las solicitadas, sin presentarla como cobertura completa

## ADDED Requirements

### Requirement: Gate de disponibilidad antes del formulario
El sistema SHALL solicitar fecha de entrada, fecha de salida y cantidad total de personas antes de mostrar el formulario de datos de empresa, SHALL consultar la disponibilidad real para ese intervalo y SHALL mostrar el formulario solamente cuando exista al menos una habitación disponible.

#### Scenario: Disponibilidad nula
- **WHEN** ninguna habitación activa está disponible para las fechas solicitadas
- **THEN** el sistema informa que no hay habitaciones disponibles para esas fechas y no muestra el formulario empresarial

#### Scenario: Disponibilidad existente
- **WHEN** al menos una habitación activa está disponible para las fechas solicitadas
- **THEN** el sistema muestra las habitaciones disponibles, su capacidad y el formulario empresarial para continuar con la cotización

#### Scenario: Disponibilidad cambia antes del envío
- **WHEN** una habitación seleccionada deja de estar disponible antes de enviar la cotización
- **THEN** el sistema vuelve a validar la disponibilidad, rechaza las líneas afectadas y no guarda una cotización obsoleta
