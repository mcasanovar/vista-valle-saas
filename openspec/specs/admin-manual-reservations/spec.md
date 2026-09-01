# admin-manual-reservations Specification

## Purpose

Permitir que administradores registren de forma segura reservas multi-habitación recibidas por canales externos, con la misma información y salvaguardas de la reserva pública.

## Requirements

### Requirement: Reserva administrativa multi-habitación
El sistema SHALL permitir a un administrador autorizado crear una reserva manual para una o más habitaciones, con fechas y capacidad validadas contra la disponibilidad vigente al confirmar, tanto en el contexto mock como en producción persistente.

#### Scenario: Creación disponible para varias habitaciones
- **WHEN** el administrador selecciona fechas válidas y varias habitaciones disponibles
- **THEN** el sistema crea una única reserva confirmada con todos los ítems de habitación y una referencia pública segura

#### Scenario: Conflicto de disponibilidad
- **WHEN** una de las habitaciones deja de estar disponible antes de confirmar
- **THEN** el sistema no crea ninguna parte de la reserva y comunica el conflicto sin aceptar disponibilidad enviada por el cliente

#### Scenario: Creación persistente autorizada
- **WHEN** un administrador autorizado confirma una reserva válida en producción
- **THEN** el sistema persiste huésped, reserva, ítems, pago pendiente y evento de notificación mediante una única operación transaccional

#### Scenario: Fallo durante la persistencia
- **WHEN** falla la creación de cualquier elemento de una reserva manual en producción
- **THEN** el sistema revierte huésped, reserva, ítems, pago y outbox asociados sin dejar datos parciales

### Requirement: Datos equivalentes de huésped y factura
El sistema SHALL solicitar nombre, apellido, correo, teléfono y comentario opcional, y SHALL permitir una solicitud de factura opcional con sus datos completos, aplicando las mismas validaciones de los datos públicos equivalentes.

#### Scenario: Reserva con solicitud de factura
- **WHEN** el administrador solicita factura y completa sus datos válidos
- **THEN** el sistema guarda la solicitud junto a la reserva manual

#### Scenario: Datos incompletos o inválidos
- **WHEN** el administrador envía datos de huésped o factura inválidos
- **THEN** el sistema muestra los errores correspondientes y no crea una reserva parcial

### Requirement: Origen externo y pago al llegar
El sistema SHALL registrar un origen administrativo permitido y SHALL crear cada reserva manual exclusivamente como pago al llegar, con reserva confirmada y pago pendiente calculado por el servidor.

#### Scenario: Reserva desde un canal externo
- **WHEN** el administrador elige un origen permitido y confirma una reserva válida
- **THEN** el sistema registra ese origen y genera sólo un pago pendiente al llegar, sin exponer controles para otro medio de pago

#### Scenario: Manipulación de precio o pago
- **WHEN** el cliente intenta enviar precio, estado, disponibilidad o condición de pago
- **THEN** el sistema ignora esos valores y deriva los datos autorizados en el servidor

### Requirement: Experiencia coherente y feedback de carga
El sistema SHALL conservar el lenguaje visual de la sección Reservas del dashboard y SHALL mostrar skeletons con shimmer mientras carga datos, además de botones deshabilitados con spinner y etiqueta visible durante acciones asíncronas.

#### Scenario: Carga de datos del formulario
- **WHEN** el formulario obtiene las habitaciones o disponibilidad iniciales
- **THEN** el sistema muestra skeletons en lugar de controles con datos incompletos

#### Scenario: Confirmación en curso
- **WHEN** el administrador confirma la reserva manual
- **THEN** el botón se deshabilita, muestra un spinner y conserva texto visible hasta obtener el resultado
