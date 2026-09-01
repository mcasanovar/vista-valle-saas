## Purpose

Permitir que empresas soliciten una cotización automática para múltiples habitaciones y reciban por correo un resumen calculado con valores transparentes, manteniendo una base segura para persistencia y entrega real.

## ADDED Requirements

### Requirement: Página dedicada de cotización empresarial
El sistema SHALL ofrecer la cotización empresarial en `/cotizacion-empresa` y SHALL mantener el landing limitado a la sección empresarial con su botón “Solicitar cotización”.

#### Scenario: Acceso desde el landing
- **WHEN** el visitante activa “Solicitar cotización” en el landing
- **THEN** el sistema navega a `/cotizacion-empresa` y no muestra el formulario completo dentro del landing

#### Scenario: Apertura directa
- **WHEN** el visitante abre `/cotizacion-empresa` directamente
- **THEN** el sistema presenta una página pública con navegación, contexto de la cotización, formulario y pie de página consistentes con Vista Valle

### Requirement: Selección de habitaciones y capacidad visible
El sistema SHALL permitir indicar la cantidad total de personas y la cantidad de habitaciones por tipo, SHALL mostrar la capacidad máxima de cada habitación antes del envío y SHALL validar la capacidad acumulada seleccionada.

#### Scenario: Capacidades mock iniciales
- **WHEN** el visitante consulta las opciones de habitación
- **THEN** el sistema muestra Individual con capacidad máxima de 1 persona, Matrimonial con capacidad máxima de 1 persona y Doble con capacidad máxima de 2 personas

#### Scenario: Capacidad suficiente
- **WHEN** la cantidad total de personas es menor o igual a la capacidad sumada de las habitaciones solicitadas
- **THEN** el sistema indica que la capacidad es suficiente y permite continuar

#### Scenario: Capacidad insuficiente
- **WHEN** la cantidad total de personas supera la capacidad sumada de las habitaciones solicitadas
- **THEN** el sistema indica cuánta capacidad falta, identifica el ajuste necesario y no envía la solicitud

#### Scenario: Cantidades inválidas
- **WHEN** el visitante indica cantidades de habitaciones negativas, fraccionarias o no válidas
- **THEN** el sistema marca el campo correspondiente y no calcula ni envía una cotización válida

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
El sistema SHALL generar un correo de confirmación para el cliente con el resumen y valores de la cotización, y SHALL generar un correo operativo para Vista Valle con los datos necesarios para revisar la solicitud.

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
