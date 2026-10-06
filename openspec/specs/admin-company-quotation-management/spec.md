# admin-company-quotation-management Specification

## Purpose

Darle al administrador visibilidad de solo lectura sobre las cotizaciones de empresa solicitadas, con listado, búsqueda/filtros y detalle, análoga a la administración de reservas.

## Requirements

### Requirement: Listado de cotizaciones
El sistema SHALL permitir listar, buscar y filtrar las cotizaciones de empresa registradas, exclusivamente contra los datos de producción. El listado SHALL presentarse paginado, con las cotizaciones más recientemente creadas primero por defecto. El sistema SHALL permitir buscar por texto libre sobre empresa, contacto, email y teléfono, y SHALL permitir filtrar por fecha de check-in, fecha de check-out y estado de entrega de la notificación asociada.

#### Scenario: Búsqueda por datos de la empresa o contacto
- **WHEN** el administrador escribe un término que coincide con la empresa, el contacto, el email o el teléfono de una cotización
- **THEN** el sistema muestra únicamente las cotizaciones que coinciden

#### Scenario: Filtro por fecha de check-in
- **WHEN** el administrador filtra por una fecha o rango de fechas de check-in
- **THEN** el sistema muestra únicamente las cotizaciones cuya fecha de check-in cae dentro de ese filtro

#### Scenario: Orden por defecto
- **WHEN** el administrador abre el listado sin aplicar ningún filtro
- **THEN** el sistema muestra primero las cotizaciones creadas más recientemente

### Requirement: Detalle de cotización
El sistema SHALL mostrar, para una cotización específica, los datos de la empresa y el contacto (nombre de empresa, contacto, email, teléfono), la estadía (check-in, check-out, noches, cantidad de personas), cada línea de habitación cotizada con su capacidad, precio por noche, cantidad y subtotal, el desayuno cuando fue solicitado (cantidad, precio unitario, subtotal), el total agregado en CLP, el mensaje libre de la empresa cuando exista, y el estado de entrega de sus notificaciones asociadas.

#### Scenario: Cotización con varias habitaciones
- **WHEN** el administrador abre una cotización que incluye varias líneas de habitación
- **THEN** puede identificar cada línea, su capacidad, precio por noche, cantidad y subtotal, además del total agregado

#### Scenario: Cotización sin desayuno solicitado
- **WHEN** el administrador abre una cotización donde no se solicitó desayuno
- **THEN** el detalle no muestra cantidad, precio unitario ni subtotal de desayuno

#### Scenario: Cotización no encontrada
- **WHEN** el administrador navega a una cotización cuyo identificador no existe
- **THEN** el sistema responde con una página de no encontrado, sin exponer información de otras cotizaciones

### Requirement: Acceso restringido a administradores
El sistema SHALL requerir autorización administrativa tanto en la página de listado y detalle como en cada función de lectura de datos de cotizaciones, sin depender únicamente de la protección de un layout compartido.

#### Scenario: Acceso sin autorización
- **WHEN** una solicitud sin autorización administrativa intenta leer el listado o el detalle de cotizaciones
- **THEN** el sistema la rechaza o redirige, sin exponer datos de ninguna cotización

### Requirement: Sin ciclo de vida de aprobación
El sistema SHALL presentar la cotización como un registro de solo lectura en esta sección, sin ofrecer controles para aprobar, rechazar o cambiar un estado operativo de negocio de la cotización desde esta vista.

#### Scenario: Vista de solo lectura
- **WHEN** el administrador abre el detalle de una cotización
- **THEN** no encuentra controles para cambiar su estado de negocio, solo la información registrada y el estado de entrega de sus notificaciones
