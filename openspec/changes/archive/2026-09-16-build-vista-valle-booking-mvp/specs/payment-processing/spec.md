## Purpose

Mantener el estado financiero de una reserva —pago al llegar en este MVP— separado del estado de la reserva, de forma auditable. El pago online mediante Mercado Pago Checkout Pro queda fuera de alcance de este MVP (ver design.md, decisión 7); el modelo de datos conserva los campos necesarios para incorporarlo en una fase posterior sin cambiar las reglas descritas aquí.

## ADDED Requirements

### Requirement: Estados independientes de pago
El sistema SHALL mantener estados de pago pendiente, aprobado, rechazado, cancelado y reembolsado sin inferirlos exclusivamente desde el estado de la reserva.

#### Scenario: Reserva pagar al llegar
- **WHEN** se confirma una reserva bajo esa modalidad
- **THEN** la reserva queda confirmada y el pago permanece pendiente

### Requirement: Cancelaciones con pago aprobado
El sistema SHALL preservar el pago aprobado al cancelar una reserva y SHALL indicar que cualquier devolución debe gestionarse y registrarse explícitamente según la política comercial vigente.

#### Scenario: Cancelación pagada sin devolución registrada
- **WHEN** se cancela una reserva con pago aprobado
- **THEN** el pago continúa aprobado y el panel advierte que requiere resolución financiera
