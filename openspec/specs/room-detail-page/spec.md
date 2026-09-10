# room-detail-page Specification

## Purpose

Definir la estructura visual y el orden de presentación de la página pública de detalle de una habitación individual, para que su implementación sea verificable y consistente con el diseño de referencia aprobado por Vista Valle.

## Requirements

### Requirement: Orden de secciones de la página de detalle
El sistema SHALL presentar la página de detalle de habitación en el siguiente orden: encabezado del sitio con navegación, aviso de contenido de demostración cuando la habitación provenga de fixtures mock, título de la habitación con descripción breve, galería de imágenes, panel de características y servicios, y tarjeta de precio con acceso a reserva.

#### Scenario: Renderizado de una habitación activa
- **WHEN** un visitante abre la página de detalle de una habitación activa
- **THEN** el sistema presenta las secciones en el orden definido, sin omitir ninguna sección aplicable

#### Scenario: Habitación de demostración
- **WHEN** la habitación mostrada proviene de fixtures mock bajo el contexto `mock`
- **THEN** el sistema presenta el aviso de contenido de demostración inmediatamente debajo del encabezado y antes del título de la habitación

### Requirement: Galería de imágenes en fila
El sistema SHALL presentar las fotografías de la habitación en una galería de tres imágenes de igual tamaño dispuestas en una sola fila en pantallas de escritorio, y SHALL adaptar la disposición a una presentación apilada o deslizable en pantallas móviles sin perder el acceso a ninguna fotografía.

#### Scenario: Galería en escritorio
- **WHEN** la página de detalle se visualiza en una pantalla de escritorio
- **THEN** el sistema muestra las tres primeras fotografías de la habitación en una fila de igual ancho

#### Scenario: Galería en móvil
- **WHEN** la página de detalle se visualiza en una pantalla móvil
- **THEN** el sistema presenta las fotografías de forma apilada o deslizable, permitiendo ver cada una sin pérdida de contenido

### Requirement: Panel de características con íconos
El sistema SHALL presentar la capacidad, la cantidad y tipo de camas, y el baño de la habitación como un conjunto de indicadores con ícono, etiqueta y valor, agrupados bajo un encabezado "Características".

#### Scenario: Visualización de características
- **WHEN** un visitante revisa la sección de características de una habitación
- **THEN** el sistema muestra un indicador con ícono para capacidad, uno para camas y uno para baño, cada uno con su valor correspondiente

### Requirement: Lista de verificación de servicios
El sistema SHALL presentar los servicios incluidos de la habitación como una lista de verificación agrupada bajo un encabezado "Servicios", donde cada servicio muestra una marca de verificación junto a su nombre.

#### Scenario: Visualización de servicios
- **WHEN** un visitante revisa la sección de servicios de una habitación
- **THEN** el sistema lista cada servicio incluido con una marca de verificación visible

### Requirement: Tarjeta de precio y llamado a la acción
El sistema SHALL presentar una tarjeta de precio que, cuando la habitación admita más de un huésped, incluya un selector de ocupación (1 o 2 personas) cuyo precio por noche se actualice de inmediato al cambiar la selección; cuando la habitación admita solo 1 huésped, o aún no se haya elegido ocupación, SHALL mostrar el precio con la etiqueta "Desde" y la unidad por noche. La tarjeta SHALL incluir un botón de llamado a la acción hacia la disponibilidad o reserva de esa habitación con la ocupación elegida, y un enlace de retorno al catálogo de habitaciones.

#### Scenario: Interacción con la tarjeta de precio
- **WHEN** un visitante revisa la página de detalle de una habitación activa con capacidad 1, o de una con capacidad mayor antes de elegir ocupación
- **THEN** el sistema muestra el precio con la etiqueta "Desde" por noche, un botón que inicia el flujo de disponibilidad o reserva para esa habitación, y un enlace visible para volver al catálogo de habitaciones

#### Scenario: Selector de ocupación en el detalle
- **WHEN** un visitante revisa el detalle de una habitación con capacidad mayor a 1 y elige 1 o 2 personas
- **THEN** el sistema actualiza de inmediato el precio por noche mostrado en la tarjeta según la ocupación elegida, y esa ocupación se usa al continuar hacia disponibilidad o reserva
