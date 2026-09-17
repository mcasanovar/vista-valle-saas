## Purpose

Definir qué operaciones de reservas, pagos y bloqueos puede invocar el asistente en nombre del administrador, separando las consultas —que se resuelven de inmediato— de las modificaciones, que solo se ejecutan tras una confirmación humana sobre una propuesta revalidada contra datos reales.

## ADDED Requirements

### Requirement: Paridad con las pantallas de administración
El asistente MUST invocar, para cada operación de escritura, la misma lógica de dominio que utiliza la pantalla de administración equivalente, y MUST NOT disponer de un camino de escritura propio.

#### Scenario: Regla de negocio compartida
- **WHEN** una operación solicitada al asistente incumple una regla de negocio que la pantalla equivalente también rechazaría
- **THEN** el sistema la rechaza con el mismo criterio y comunica el motivo al administrador

#### Scenario: Operación fuera de la superficie declarada
- **WHEN** el administrador solicita una acción que el asistente no expone, como modificar tarifas, editar habitaciones, gestionar fotos o cotizaciones de empresa
- **THEN** el asistente declina la acción, explica que no forma parte de su alcance y no ejecuta nada

### Requirement: Consultas de disponibilidad, reservas y bloqueos
El asistente SHALL resolver sin confirmación previa las consultas de solo lectura sobre disponibilidad por fecha o rango, reservas y sus detalles, y bloqueos de habitación.

#### Scenario: Disponibilidad por rango
- **WHEN** el administrador consulta qué hay disponible entre dos fechas
- **THEN** el asistente responde con las habitaciones disponibles para ese intervalo según la disponibilidad vigente del sistema

#### Scenario: Reservas de un huésped
- **WHEN** el administrador pide las reservas asociadas a una persona identificándola por nombre, correo, teléfono, RUT o empresa
- **THEN** el asistente responde con las reservas que corresponden a ese criterio de búsqueda

#### Scenario: Detalle de una reserva
- **WHEN** el administrador pide el detalle de una reserva concreta
- **THEN** el asistente responde con sus datos vigentes, incluido el estado de la reserva, el estado de pago y el historial de cambios de estado

#### Scenario: Consulta sin resultados
- **WHEN** una consulta no arroja resultados
- **THEN** el asistente lo comunica explícitamente y MUST NOT inventar reservas, huéspedes, habitaciones ni montos

### Requirement: Consultas de resultados económicos y ocupación
El asistente SHALL responder consultas sobre ingresos aprobados, cantidad de reservas válidas, ocupación y desglose por canal para un mes o un año determinado, usando las cifras que el sistema ya calcula.

#### Scenario: Ingresos del mes
- **WHEN** el administrador pregunta cuánto se ganó en un mes determinado
- **THEN** el asistente responde con el ingreso aprobado de ese período tal como lo calcula el sistema, sin recalcularlo por su cuenta

#### Scenario: Período implícito
- **WHEN** el administrador pregunta por resultados sin nombrar el período
- **THEN** el asistente resuelve el período contra la fecha actual en `America/Santiago` y declara explícitamente a qué período corresponde la cifra entregada

### Requirement: Propuesta obligatoria para toda escritura
El sistema MUST presentar una propuesta y obtener confirmación explícita del administrador antes de crear una reserva, editar sus fechas, cambiar su estado, registrar un pago, crear un bloqueo o eliminarlo.

#### Scenario: Propuesta sin confirmar
- **WHEN** el asistente produce una interpretación válida de una operación de escritura
- **THEN** ningún dato del sistema cambia hasta que el administrador confirma explícitamente esa propuesta

#### Scenario: Contenido de la propuesta
- **WHEN** el sistema presenta una propuesta de escritura
- **THEN** la propuesta identifica la operación, la entidad afectada y los valores interpretados en términos absolutos, incluidas las fechas resueltas

#### Scenario: Propuesta rechazada
- **WHEN** el administrador rechaza la propuesta
- **THEN** el sistema descarta la operación sin modificar datos y la propuesta queda inutilizable

#### Scenario: Propuesta expirada
- **WHEN** el administrador confirma una propuesta cuyo plazo de vigencia ya venció
- **THEN** el sistema rechaza la ejecución, no modifica datos y comunica que la propuesta expiró

#### Scenario: Confirmación repetida
- **WHEN** una propuesta ya confirmada se intenta confirmar otra vez
- **THEN** el sistema no ejecuta la operación por segunda vez

### Requirement: Revalidación determinista en la confirmación
El sistema MUST revalidar la operación completa contra los datos vigentes en el momento de la confirmación, y MUST NOT confiar en los valores producidos por el modelo de IA ni en los vigentes cuando se generó la propuesta.

#### Scenario: Entidad inexistente
- **WHEN** la interpretación del modelo hace referencia a una habitación, reserva o bloqueo que no existe
- **THEN** el sistema rechaza la propuesta y no ejecuta ninguna modificación

#### Scenario: Disponibilidad tomada entre la propuesta y la confirmación
- **WHEN** entre la generación de la propuesta y su confirmación desaparece la disponibilidad que la operación requiere
- **THEN** el sistema no ejecuta la operación y comunica el conflicto al administrador

#### Scenario: Montos calculados por el sistema
- **WHEN** una propuesta involucra un precio o un total
- **THEN** ese valor MUST ser calculado por el sistema a partir de las tarifas vigentes, y MUST NOT provenir del modelo de IA

### Requirement: Creación de reservas manuales
El asistente SHALL proponer la creación de reservas manuales con habitación, intervalo, huéspedes, datos del huésped y origen, sujeta a las mismas validaciones de disponibilidad, capacidad y fechas que la creación manual existente.

#### Scenario: Datos insuficientes
- **WHEN** faltan datos obligatorios para crear la reserva
- **THEN** el asistente los solicita y no genera una propuesta incompleta

#### Scenario: Habitación no disponible
- **WHEN** la habitación solicitada no está disponible en el intervalo pedido
- **THEN** el sistema no crea la reserva y comunica la indisponibilidad

### Requirement: Edición de fechas de una reserva
El asistente SHALL proponer el cambio de fechas de una reserva existente, sujeto a las mismas validaciones que la edición de fechas existente.

#### Scenario: Cambio de fechas con conflicto
- **WHEN** el nuevo intervalo se superpone con otra reserva o bloqueo incompatible
- **THEN** el sistema no aplica el cambio y comunica el conflicto

### Requirement: Cambio de estado de una reserva sin efectos sobre el pago
El asistente SHALL proponer transiciones de estado de una reserva a `cancelled`, `completed` o `no_show`. El sistema MUST NOT modificar el estado de pago ni iniciar ningún reembolso como consecuencia de esa transición.

#### Scenario: Cancelación de una reserva pagada
- **WHEN** el administrador confirma la cancelación de una reserva cuyo pago está aprobado
- **THEN** el sistema cambia el estado de la reserva a `cancelled`, deja el estado de pago intacto y no inicia ningún reembolso

#### Scenario: Visibilidad del estado de pago al cancelar
- **WHEN** el sistema presenta una propuesta de cancelación de una reserva con pago aprobado
- **THEN** la propuesta muestra el estado de pago y el monto involucrado como información, advirtiendo que la devolución del dinero se gestiona fuera del sistema

#### Scenario: Transición no permitida
- **WHEN** la transición solicitada no es válida desde el estado actual de la reserva
- **THEN** el sistema la rechaza y comunica el estado vigente

### Requirement: Registro de cobros
El asistente SHALL proponer el registro del cobro de pagos pendientes, sujeto a las mismas validaciones que el registro de cobros existente en el panel.

#### Scenario: Cobro de un pago pendiente
- **WHEN** el administrador confirma el registro del cobro de un pago pendiente
- **THEN** el sistema lo registra usando la misma lógica que la pantalla de administración correspondiente

#### Scenario: Pago que no admite cobro
- **WHEN** el pago referido no está en un estado que admita registrar un cobro
- **THEN** el sistema no lo registra y comunica el estado vigente del pago

### Requirement: Creación y eliminación de bloqueos
El asistente SHALL proponer la creación de bloqueos de habitación con habitación, intervalo y motivo, y su eliminación, sujetos a las mismas validaciones que la gestión manual de bloqueos.

#### Scenario: Bloqueo sobre fechas ocupadas
- **WHEN** el bloqueo confirmado se superpone con una reserva o retención incompatible
- **THEN** el sistema no crea el bloqueo y muestra el conflicto al administrador

#### Scenario: Eliminación de un bloqueo
- **WHEN** el administrador confirma la eliminación de un bloqueo existente
- **THEN** el sistema lo elimina y la disponibilidad correspondiente vuelve a quedar liberada
