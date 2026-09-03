# channel-calendar-sync Specification

## Purpose

Mantener el calendario de ocupación de Vista Valle sincronizado con canales externos (Airbnb, y más adelante Booking.com) mediante calendarios iCal entrantes y salientes por habitación, reduciendo la sobreventa entre canales sin depender de una integración API de partner ni de scraping.

## Requirements

### Requirement: Conexión de canal por plataforma y habitación
El sistema SHALL modelar cada conexión de sincronización como una combinación de plataforma externa (Airbnb, Booking u otra futura) y habitación, con su propia URL de feed entrante, token de feed saliente y comportamiento de pago, de modo que activar una plataforma adicional no requiera cambiar el mecanismo de sincronización.

#### Scenario: Activar una nueva plataforma
- **WHEN** un administrador configura una conexión de sincronización para Booking.com y una habitación existente
- **THEN** el sistema aplica el mismo mecanismo de ingesta, publicación y detección de conflictos ya usado para Airbnb, sin requerir código específico de esa plataforma

### Requirement: Ingesta entrante crea reservas reales
El sistema SHALL sondear periódicamente el feed iCal entrante de cada conexión activa y, por cada evento de ocupación no visto antes, crear una reserva confirmada con el mismo mecanismo transaccional de bloqueo de habitaciones que usa cualquier otra reserva, con origen igual a la plataforma de la conexión.

#### Scenario: Nuevo evento en el feed de Airbnb
- **WHEN** el sondeo encuentra un evento de ocupación en el feed de Airbnb para una habitación cuyas fechas no tienen ninguna reserva, retención activa o bloqueo previo del sistema
- **THEN** el sistema crea una reserva confirmada con origen Airbnb para esas fechas y esa habitación

### Requirement: Identificación idempotente de eventos entrantes
El sistema SHALL asociar cada reserva creada por sincronización con el identificador único del evento de origen y SHALL usar ese identificador para reconocer sondeos posteriores del mismo evento sin duplicar la reserva.

#### Scenario: Mismo evento en sondeos sucesivos
- **WHEN** el sondeo vuelve a encontrar un evento cuyo identificador ya está asociado a una reserva existente
- **THEN** el sistema no crea una reserva adicional

### Requirement: Comportamiento de pago específico por plataforma
El sistema SHALL determinar el estado de pago de una reserva creada por sincronización según la conexión de canal: aprobado automáticamente para plataformas que cobran directamente al huésped (Airbnb), y pendiente de pago al llegar para plataformas que no lo hacen (Booking), sin mezclar ambos comportamientos.

#### Scenario: Reserva sincronizada desde Airbnb
- **WHEN** el sistema crea una reserva a partir de un evento entrante de la conexión de Airbnb
- **THEN** el pago asociado queda aprobado, sin requerir registro de pago presencial

#### Scenario: Reserva sincronizada desde Booking
- **WHEN** el sistema crea una reserva a partir de un evento entrante de la conexión de Booking
- **THEN** el pago asociado queda pendiente de pago al llegar, igual que una reserva de Booking ingresada manualmente

### Requirement: Datos de huésped de reservas sincronizadas
El sistema SHALL registrar un huésped identificable como "pendiente de datos reales" para toda reserva creada por sincronización, dado que el feed entrante no incluye datos personales del huésped, y SHALL permitir que un administrador los complete posteriormente desde el detalle de la reserva.

#### Scenario: Detalle de una reserva sincronizada sin editar
- **WHEN** un administrador abre el detalle de una reserva creada por sincronización antes de completar los datos reales del huésped
- **THEN** el sistema muestra un huésped placeholder reconocible como tal, sin datos de contacto inventados presentados como reales

### Requirement: Sin notificación transaccional para reservas sincronizadas
El sistema SHALL omitir el envío de correo de confirmación transaccional para una reserva creada por sincronización, dado que el huésped ya recibió su confirmación a través de la plataforma externa.

#### Scenario: Reserva creada por sincronización
- **WHEN** el sistema crea una reserva a partir de un evento entrante
- **THEN** no se genera ningún evento de notificación de confirmación para esa reserva

### Requirement: Cancelación por desaparición del evento externo
El sistema SHALL detectar cuando un evento previamente sincronizado deja de aparecer en el feed entrante y SHALL cancelar la reserva asociada usando la misma transición de estado que una cancelación administrativa, dejando el estado del pago sin alterar.

#### Scenario: Evento retirado del feed de Airbnb
- **WHEN** un evento previamente sincronizado ya no aparece en un sondeo posterior del feed entrante
- **THEN** el sistema cancela la reserva asociada, conserva el pago aprobado sin modificarlo y libera la disponibilidad de esas fechas

### Requirement: Publicación de feed saliente por habitación
El sistema SHALL exponer, para cada conexión de canal activa, un feed iCal de solo lectura con las fechas ocupadas por reservas de otros orígenes, protegido por un identificador no adivinable, y SHALL excluir del feed de una plataforma las reservas que se originaron en esa misma plataforma.

#### Scenario: Consulta del feed saliente de Airbnb
- **WHEN** la plataforma Airbnb consulta el feed saliente configurado para una habitación
- **THEN** el sistema devuelve las fechas ocupadas por reservas, retenciones vigentes y bloqueos de cualquier origen distinto a Airbnb para esa habitación

#### Scenario: Acceso sin el identificador correcto
- **WHEN** alguien solicita un feed saliente sin el identificador asignado a esa conexión
- **THEN** el sistema rechaza la solicitud sin exponer datos de ocupación

### Requirement: Alerta de conflicto en la ingesta
El sistema SHALL detectar cuando un evento entrante se superpone con una reserva u retención vigente ya existente para la misma habitación y fechas, SHALL descartar la creación de la reserva conflictiva sin alterar la reserva u retención existente, y SHALL generar una alerta operativa identificando el conflicto. Esta alerta SHALL persistir y quedar visible para el administrador tanto en contexto mock como en contexto de producción.

#### Scenario: Evento entrante choca con una reserva web existente
- **WHEN** el sondeo encuentra un evento entrante cuyas fechas se superponen con una reserva o retención ya registrada en el sistema para la misma habitación
- **THEN** el sistema no crea la reserva del evento entrante, conserva intacta la reserva u retención existente, y registra una alerta visible para el administrador describiendo la superposición detectada

#### Scenario: Conflicto detectado en producción
- **WHEN** el sondeo detecta este conflicto bajo contexto de producción
- **THEN** el sistema persiste la alerta de forma que sobrevive a un reinicio del proceso y aparece en la pantalla de alertas del administrador, en vez de descartarse en memoria

### Requirement: Alerta de conflicto por vencimiento de retención durante sincronización
El sistema SHALL generar la misma alerta operativa de conflicto cuando una retención de pago en línea vence y su reserva no puede confirmarse porque, en el intervalo, una sincronización externa ocupó la habitación para las mismas fechas. Esta alerta SHALL persistir de la misma forma que la alerta de conflicto en la ingesta, en cualquier contexto.

#### Scenario: Pago aprobado después de vencer la retención por ocupación externa
- **WHEN** un pago en línea se aprueba para una retención ya vencida cuya habitación fue ocupada por una reserva sincronizada durante la ventana de vencimiento
- **THEN** el sistema no confirma una reserva conflictiva a partir de ese pago y registra una alerta visible para el administrador describiendo la situación para que coordine con el huésped

### Requirement: La cola manual no duplica una conexión activa
El sistema SHALL omitir la creación de una tarea de sincronización manual para una combinación de plataforma y habitación cuya conexión de canal esté activa, dado que esa plataforma ya recibe el bloqueo de fechas de forma automática a través del feed saliente.

#### Scenario: Reserva web confirmada con Airbnb conectado y Booking sin conectar
- **WHEN** se confirma una reserva originada en el sitio web para una habitación cuya conexión de canal con Airbnb está activa y cuya conexión con Booking no lo está
- **THEN** el sistema crea únicamente la tarea de sincronización manual para Booking, sin crear una tarea para Airbnb

#### Scenario: Reserva web confirmada sin ninguna conexión activa
- **WHEN** se confirma una reserva originada en el sitio web para una habitación sin ninguna conexión de canal activa
- **THEN** el sistema crea las tareas de sincronización manual para Airbnb y Booking, igual que el comportamiento actual

### Requirement: Cadencia de sondeo configurable
El sistema SHALL permitir configurar la frecuencia con la que sondea cada feed entrante, de forma independiente para cada conexión de canal, sin asumir que la plataforma externa actualiza su propio feed con una cadencia conocida o garantizada.

#### Scenario: Cambio de cadencia de sondeo
- **WHEN** un administrador o la configuración operativa del sistema cambia la frecuencia de sondeo de una conexión
- **THEN** el sistema aplica la nueva frecuencia sin requerir cambios en la lógica de ingesta
