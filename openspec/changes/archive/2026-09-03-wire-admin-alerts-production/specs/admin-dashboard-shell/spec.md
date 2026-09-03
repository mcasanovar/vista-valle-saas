## MODIFIED Requirements

### Requirement: Tarjetas KPI de la pantalla Resumen
El sistema SHALL presentar en la pantalla Resumen cuatro indicadores clave: ocupación actual (porcentaje), reservas activas (cantidad), pagos pendientes (monto) y alertas abiertas (cantidad), cada uno con su variación respecto al periodo anterior cuando esté disponible. El indicador de alertas abiertas SHALL reflejar datos reales bajo contexto de producción, no solo bajo el contexto mock.

#### Scenario: Datos operativos disponibles
- **WHEN** el sistema puede calcular los indicadores operativos a partir de las reservas registradas
- **THEN** el sistema muestra los cuatro indicadores con su valor actual y su variación

#### Scenario: Pago pendiente en el mock administrativo
- **WHEN** una reserva mock tiene `paymentStatus` pendiente
- **THEN** el sistema suma su `totalClp` en pagos pendientes, sin inferir el estado de pago a partir del estado de la reserva

#### Scenario: Alertas abiertas en producción
- **WHEN** el sistema calcula el indicador de alertas abiertas bajo contexto de producción
- **THEN** el sistema cuenta, como mínimo, pagos "al llegar" pendientes y conflictos de sincronización de canal a partir de datos persistidos, sin depender de datos mock ni devolver el indicador como no disponible únicamente por no estar en contexto mock. Notificaciones fallidas se suma a este conteo cuando exista un procesador de outbox de producción que pueda marcar una notificación como fallida; hasta entonces el indicador no las incluye.

#### Scenario: Datos operativos no disponibles
- **WHEN** el sistema no puede calcular los indicadores operativos
- **THEN** el sistema comunica explícitamente que el resumen operativo no está disponible, sin mostrar valores inventados ni tarjetas vacías silenciosas
