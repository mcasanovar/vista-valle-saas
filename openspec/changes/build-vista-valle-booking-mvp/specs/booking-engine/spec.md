## Purpose

Gestionar disponibilidad, precios, huéspedes y reservas de cada habitación con reglas consistentes y protección frente a superposiciones, incluso cuando existen solicitudes concurrentes.

## ADDED Requirements

### Requirement: Consulta de disponibilidad por habitación
El sistema SHALL calcular disponibilidad para un intervalo de alojamiento usando reservas activas, retenciones de pago vigentes y bloqueos administrativos de cada habitación.

#### Scenario: Habitación ocupada parcialmente
- **WHEN** el intervalo solicitado se superpone con una reserva confirmada, una retención vigente o un bloqueo
- **THEN** el sistema informa que la habitación no está disponible para ese intervalo

#### Scenario: Cambio de huésped el mismo día
- **WHEN** una reserva termina el mismo día en que otra comienza
- **THEN** los intervalos no se consideran superpuestos

### Requirement: Fechas hoteleras locales
El sistema SHALL representar check-in y check-out como fechas de calendario bajo la zona `America/Santiago`, usando intervalos inclusivos en check-in y exclusivos en check-out.

#### Scenario: Cálculo de noches
- **WHEN** el huésped selecciona entrada el 5 de mayo y salida el 8 de mayo
- **THEN** el sistema calcula tres noches independientemente de cambios horarios

### Requirement: Consulta pública solo para fechas vigentes o futuras
El sistema SHALL rechazar una consulta pública de disponibilidad cuyo check-in sea anterior a la fecha actual en `America/Santiago`. El check-out SHALL ser como mínimo el día siguiente a la fecha actual y SHALL ser posterior al check-in. El sistema SHALL aplicar esta regla de forma autoritativa antes de consultar disponibilidad; los límites de los controles de fecha solo mejoran la guía de interfaz.

#### Scenario: Fecha de entrada anterior a hoy
- **WHEN** un visitante consulta disponibilidad con una fecha de entrada anterior a la fecha actual en `America/Santiago`
- **THEN** el sistema no ejecuta la consulta, identifica la fecha de entrada como inválida y muestra un mensaje de corrección en español

#### Scenario: Estadía mínima desde hoy
- **WHEN** un visitante consulta disponibilidad con entrada en la fecha actual de `America/Santiago` y salida al día siguiente
- **THEN** el sistema acepta los criterios y puede continuar la consulta de disponibilidad

#### Scenario: Fecha de salida no válida
- **WHEN** un visitante consulta con salida anterior al día siguiente actual o no posterior a su fecha de entrada
- **THEN** el sistema no ejecuta la consulta e identifica la fecha de salida como inválida con un mensaje en español

### Requirement: Reserva multi-habitación con fechas compartidas
El sistema SHALL permitir que una reserva web contenga una o más habitaciones distintas con un único check-in y check-out. El sistema SHALL permitir formar esa selección desde resultados de disponibilidad o desde el detalle de una habitación y SHALL mostrar la selección antes de confirmar.

#### Scenario: Agregar desde disponibilidad
- **WHEN** el huésped consulta disponibilidad y agrega una habitación disponible desde los resultados
- **THEN** la habitación queda incluida en la selección de reserva para las fechas consultadas sin requerir abrir su detalle

#### Scenario: Agregar desde detalle
- **WHEN** el huésped abre el detalle de una habitación disponible y la agrega a su reserva
- **THEN** la habitación queda incluida en la misma selección y el huésped puede continuar explorando otras habitaciones

### Requirement: Cálculo autoritativo del precio multi-habitación
El sistema SHALL calcular en backend cantidad de noches común, precio por noche, cargos aplicables y subtotal de cada habitación seleccionada, además del total agregado de la reserva, y SHALL congelar esos valores al crear la reserva o retención.

#### Scenario: Total manipulado en el navegador
- **WHEN** el cliente envía subtotales o un total distinto de los calculados por el backend
- **THEN** el sistema ignora los importes enviados y utiliza los valores autoritativos por habitación y el total agregado

### Requirement: Información del huésped y solicitud tributaria condicional
El sistema SHALL solicitar y validar nombre, apellido, correo y teléfono del titular de la reserva. El checkout público SHALL NO solicitar ni validar cantidad de huéspedes ni asignarlos a habitaciones; esa información queda limitada al flujo de cotización para empresas. El sistema SHALL ofrecer una solicitud opcional de factura y, solo cuando se seleccione, SHALL exigir nombre o razón social, RUT chileno válido, teléfono de contacto, giro y correo de facturación.

#### Scenario: Reserva sin datos tributarios
- **WHEN** el huésped no selecciona solicitar factura
- **THEN** el sistema no exige, valida ni conserva antecedentes tributarios

#### Scenario: Solicitud tributaria incompleta o con RUT inválido
- **WHEN** el huésped selecciona solicitar factura y falta un antecedente obligatorio o el RUT chileno no es válido
- **THEN** el sistema rechaza la confirmación y muestra los campos que requieren corrección

### Requirement: Confirmación inmediata con pago al llegar
El sistema SHALL confirmar inmediatamente la reserva con pago al llegar cuando la habitación siga disponible, y SHALL ofrecer esta modalidad como la única forma de completar una reserva por la web en este MVP.

#### Scenario: Pago al llegar
- **WHEN** todas las habitaciones seleccionadas siguen disponibles y el huésped completa la reserva
- **THEN** el sistema crea inmediatamente una única reserva confirmada con sus ítems de habitación y un pago pendiente para la llegada

#### Scenario: Pago online fuera de alcance
- **WHEN** el huésped busca una opción de pago online durante la reserva
- **THEN** el sistema no la ofrece en este MVP y solo permite continuar con pago al llegar

### Requirement: Prevención atómica de superposiciones
El sistema MUST serializar la comprobación final y creación de reservas, retenciones y bloqueos para cada habitación implicada de modo que como máximo una operación incompatible tenga éxito. Una confirmación multi-habitación SHALL crear todos los ítems seleccionados o ninguno.

#### Scenario: Conflicto en una habitación del carrito
- **WHEN** al confirmar una selección de varias habitaciones una de ellas ya no está disponible
- **THEN** el sistema no crea una reserva parcial, devuelve indisponibilidad para esa habitación y conserva disponibles las demás según su estado actual

### Requirement: Vencimiento de retenciones
El sistema SHALL asignar vencimiento a las retenciones de pago y SHALL excluir las retenciones vencidas del cálculo de disponibilidad.

#### Scenario: Checkout abandonado
- **WHEN** vence una retención sin pago aprobado
- **THEN** la habitación vuelve a estar disponible sin intervención administrativa

### Requirement: Ciclo de vida de reserva
El sistema SHALL gestionar reservas con estados confirmada, cancelada, completada y no presentada, conservando su historial y sin borrar sus datos operativos.

#### Scenario: Cancelación de una reserva
- **WHEN** una reserva confirmada es cancelada por una operación autorizada
- **THEN** deja de bloquear disponibilidad y permanece consultable con estado cancelado

### Requirement: Confirmación visible
El sistema SHALL mostrar después de una reserva exitosa un identificador no predecible, huésped, cada habitación seleccionada, sus subtotales, fechas compartidas, noches, modalidad y total agregado.

#### Scenario: Reserva con pago al llegar
- **WHEN** se confirma una reserva con pago al llegar
- **THEN** el huésped ve el detalle completo de sus habitaciones, el total agregado y que el monto permanece pendiente para su llegada

### Requirement: Persistencia aislada en contexto mock
El sistema SHALL poder ejecutar las capacidades de disponibilidad y reserva en un contexto mock determinista que respete los mismos contratos de dominio sin conectarse a PostgreSQL, Supabase ni otros servicios externos.

#### Scenario: Prueba sin base de datos disponible
- **WHEN** una prueba ejecuta una consulta o mutación de reserva bajo el contexto mock explícito
- **THEN** el sistema utiliza persistencia controlada local, aplica las validaciones correspondientes y no realiza solicitudes de red
