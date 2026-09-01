## MODIFIED Requirements

### Requirement: Gestión de reservas
El sistema SHALL permitir listar, buscar, filtrar, consultar, modificar campos operativos permitidos y cambiar el estado de una reserva a cancelada, completada o no presentada, exclusivamente contra los datos de producción. El listado SHALL presentarse paginado, con las reservas más recientemente creadas primero por defecto. El sistema SHALL permitir buscar por texto libre sobre nombre, apellido, email, teléfono, RUT y empresa del huésped, el identificador público de la reserva, y el nombre de la o las habitaciones asociadas, sin considerar el comentario libre del huésped. El sistema SHALL permitir filtrar por fecha de llegada y, opcionalmente, por fecha de salida, cada una admitiendo tanto una fecha exacta como un rango de fechas. El detalle de una reserva SHALL identificar todas sus habitaciones, subtotales, total agregado, el o los pagos asociados con su estado, y, cuando exista, la solicitud de factura sin exponer antecedentes tributarios innecesarios. El sistema SHALL permitir cancelar una reserva confirmada independientemente de si su fecha de llegada ya pasó.

#### Scenario: Marcar no presentación
- **WHEN** el administrador marca una reserva confirmada como no presentada
- **THEN** el sistema conserva la reserva, registra el nuevo estado y su autoría

#### Scenario: Consulta de reserva con varias habitaciones
- **WHEN** el administrador abre una reserva que contiene varias habitaciones
- **THEN** puede identificar todos sus ítems y las fechas comunes para operar y completar el bloqueo manual de canales

#### Scenario: Búsqueda por cualquier campo del huésped o la reserva
- **WHEN** el administrador escribe un término de búsqueda que coincide con el nombre, apellido, email, teléfono, RUT o empresa de un huésped, con el identificador público de una reserva, o con el nombre de una habitación reservada
- **THEN** el sistema muestra únicamente las reservas que coinciden, sin considerar el comentario libre del huésped como campo de búsqueda

#### Scenario: Filtro por fecha exacta de llegada
- **WHEN** el administrador filtra por una única fecha de llegada
- **THEN** el sistema muestra solo las reservas cuya fecha de llegada coincide exactamente con esa fecha

#### Scenario: Filtro por rango de fechas de llegada
- **WHEN** el administrador filtra por un rango de fechas de llegada
- **THEN** el sistema muestra las reservas cuya fecha de llegada cae dentro de ese rango, inclusive en ambos extremos

#### Scenario: Filtro combinado de llegada y salida
- **WHEN** el administrador aplica un filtro de fecha de llegada y, adicionalmente, un filtro de fecha de salida (exacta o en rango)
- **THEN** el sistema muestra solo las reservas que satisfacen ambos filtros a la vez

#### Scenario: Listado paginado
- **WHEN** el número de reservas que coinciden con los filtros activos excede el tamaño de página
- **THEN** el sistema divide los resultados en páginas y permite navegar entre ellas sin alterar el orden ni omitir o duplicar reservas entre páginas, incluidas las reservas con varias habitaciones

#### Scenario: Detalle con pagos y factura
- **WHEN** el administrador abre el detalle de una reserva que tiene al menos un pago registrado y, opcionalmente, una solicitud de factura
- **THEN** el sistema muestra el o los pagos con su estado y monto, y, si existe la solicitud de factura, sus datos, sin exponer antecedentes tributarios que la reserva no haya registrado

#### Scenario: Cancelación de una reserva con fecha de llegada pasada
- **WHEN** el administrador cancela una reserva confirmada cuya fecha de llegada ya transcurrió
- **THEN** el sistema permite la cancelación de la misma forma que para una reserva cuya fecha de llegada aún no ocurre

#### Scenario: Detalle muestra el comentario del huésped
- **WHEN** el administrador abre el detalle de una reserva que tiene un comentario registrado por el huésped
- **THEN** el sistema muestra ese comentario en el detalle, aunque no participe en la búsqueda por texto libre

### Requirement: Registro de pago presencial
El sistema SHALL permitir marcar como recibido el pago de una reserva de pago al llegar, registrando monto, fecha, medio y administrador responsable, en cualquier momento posterior a la creación de la reserva, incluso después de finalizada la estadía. Esta acción SHALL aplicar únicamente a reservas con modalidad de pago al llegar; SHALL NOT estar disponible para reservas pagadas en línea, cuyo estado de pago se gestiona automáticamente por el proveedor de pago.

#### Scenario: Pago al check-in
- **WHEN** el administrador registra el pago completo de una reserva pendiente
- **THEN** el estado financiero refleja el pago recibido sin alterar incorrectamente las fechas de la reserva

#### Scenario: Pago registrado días después de la estadía
- **WHEN** el administrador registra el pago de una reserva de pago al llegar cuya fecha de salida ya transcurrió
- **THEN** el sistema acepta el registro del pago sin restricción de fecha

#### Scenario: Intento de registrar pago presencial en una reserva pagada en línea
- **WHEN** el administrador intenta registrar un pago presencial sobre una reserva pagada en línea
- **THEN** el sistema no ofrece esa acción para esa reserva
