## Purpose

Definir la estructura visual del shell administrativo (navegación, tema aislado del sitio público, feedback de carga) y el contenido operativo de la pantalla Resumen, para que su implementación sea verificable y consistente con el diseño de referencia aprobado.

## ADDED Requirements

### Requirement: Tema visual del admin aislado del sitio público
El sistema SHALL presentar el panel administrativo con una paleta de color y tipografía propias, distintas de las del sitio público de reservas, sin que ninguna de las dos superficies herede o filtre los valores de la otra.

#### Scenario: Navegación dentro del admin
- **WHEN** un administrador autenticado navega entre pantallas del panel admin (Resumen, Calendario, Reservas, Bloqueos, Sincronizaciones, Alertas, Asistente)
- **THEN** todas las pantallas usan el fondo, superficies de tarjeta, colores de texto y tipografía del tema admin, no los del sitio público

#### Scenario: Sitio público sin cambios
- **WHEN** un visitante navega el sitio público de reservas
- **THEN** la paleta y tipografía del sitio público permanecen exactamente como estaban antes de este cambio

### Requirement: Navegación responsiva del shell admin
El sistema SHALL adaptar la navegación del panel admin al ancho de pantalla: un sidebar fijo con etiquetas de texto en escritorio, un riel de solo iconos en tablet, y una barra de navegación inferior fija con acceso directo a las secciones principales en móvil.

#### Scenario: Escritorio
- **WHEN** un administrador abre el panel admin en una pantalla de escritorio
- **THEN** el sistema muestra un sidebar fijo a la izquierda con el nombre de cada sección visible como texto, agrupado por categoría, y resalta visualmente la sección activa

#### Scenario: Tablet
- **WHEN** un administrador abre el panel admin en una pantalla de ancho intermedio (tablet)
- **THEN** el sistema colapsa el sidebar a un riel angosto de solo iconos, conservando el acceso a todas las secciones y el resaltado de la sección activa

#### Scenario: Móvil
- **WHEN** un administrador abre el panel admin en una pantalla móvil
- **THEN** el sistema oculta el sidebar/riel y presenta en su lugar una barra de navegación inferior fija con accesos directos a Resumen, Calendario, Reservas y Alertas, más un acceso adicional a las demás secciones

### Requirement: Tarjetas KPI de la pantalla Resumen
El sistema SHALL presentar en la pantalla Resumen cuatro indicadores clave: ocupación actual (porcentaje), reservas activas (cantidad), pagos pendientes (monto) y alertas abiertas (cantidad), cada uno con su variación respecto al periodo anterior cuando esté disponible.

#### Scenario: Datos operativos disponibles
- **WHEN** el sistema puede calcular los indicadores operativos a partir de las reservas registradas
- **THEN** el sistema muestra los cuatro indicadores con su valor actual y su variación

#### Scenario: Pago pendiente en el mock administrativo
- **WHEN** una reserva mock tiene `paymentStatus` pendiente
- **THEN** el sistema suma su `totalClp` en pagos pendientes, sin inferir el estado de pago a partir del estado de la reserva

#### Scenario: Datos operativos no disponibles
- **WHEN** el sistema no puede calcular los indicadores operativos
- **THEN** el sistema comunica explícitamente que el resumen operativo no está disponible, sin mostrar valores inventados ni tarjetas vacías silenciosas

### Requirement: Tabla de reservas recientes en la pantalla Resumen
El sistema SHALL presentar, en la pantalla Resumen, una lista de las reservas más recientes con huésped, habitación, fecha de entrada, fecha de salida, estado (confirmada, pendiente o cancelada) y monto, junto con un acceso para ver todas las reservas.

#### Scenario: Reservas recientes disponibles
- **WHEN** existen reservas registradas en el sistema
- **THEN** el sistema las ordena por `createdAt` descendente, lista las más recientes con sus datos completos y un estado visualmente diferenciado por color según confirmada, pendiente o cancelada

#### Scenario: Sin reservas registradas
- **WHEN** no existen reservas registradas en el sistema
- **THEN** el sistema comunica explícitamente que no hay reservas recientes, sin mostrar una tabla vacía sin explicación

### Requirement: Retroalimentación de carga en pantallas admin
El sistema SHALL mostrar bloques con animación de carga (shimmer) en lugar del contenido real mientras las tarjetas KPI y las filas de la tabla de reservas recientes están cargando datos, y SHALL reflejar el estado de carga en el botón "Actualizar datos" sin ocultar su etiqueta.

#### Scenario: Carga inicial de la pantalla Resumen
- **WHEN** la pantalla Resumen está obteniendo los datos operativos
- **THEN** el sistema muestra bloques con shimmer en el lugar de las tarjetas KPI y de las filas de la tabla, en vez de contenido parcial o valores en cero

#### Scenario: Actualización manual de datos
- **WHEN** un administrador presiona "Actualizar datos" y la operación está en curso
- **THEN** el botón se deshabilita, reemplaza su ícono por un indicador de carga y conserva su etiqueta de texto (igual o cambiada a "Actualizando…"), nunca solo un indicador de carga sin texto
