## MODIFIED Requirements

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
