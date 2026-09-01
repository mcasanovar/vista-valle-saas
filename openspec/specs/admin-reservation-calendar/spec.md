# admin-reservation-calendar Specification

## Purpose

Dar al administrador una vista de calendario real, mobile-first, que muestre la ocupación de todas las habitaciones (reservas, retenciones y bloqueos) a lo largo del tiempo, con navegación de rango y acciones rápidas de creación y consulta de detalle.

## Requirements

### Requirement: Datos reales de ocupación
El sistema SHALL construir el calendario a partir de reservas, retenciones y bloqueos reales almacenados, sin depender de datos simulados, para cualquier rango de fechas solicitado.

#### Scenario: Calendario en producción
- **WHEN** un administrador autenticado abre `/admin/calendario` en un entorno de producción
- **THEN** el sistema consulta las reservas, retenciones y bloqueos vigentes en el rango visible y los presenta, sin mostrar el mensaje "El calendario no está disponible"

#### Scenario: Rango sin actividad
- **WHEN** el rango visible no tiene reservas, retenciones ni bloqueos para ninguna habitación
- **THEN** el sistema muestra el calendario vacío (habitaciones y fechas visibles) con una indicación explícita de que no hay ocupación, no un error

### Requirement: Vista de calendario clásica (Mes, Semana, 2 semanas)
El sistema SHALL presentar el calendario en las vistas Mes, Semana y 2 semanas como una grilla de calendario clásica en pantallas desktop y tablet: columnas fijas de lunes a domingo, una fila por cada semana del rango visible, y el número de día mostrado en tamaño reducido en la esquina superior derecha de cada celda sin ocupar el cuadro completo. Cada habitación ocupada ese día SHALL representarse como un chip dentro de la celda.

#### Scenario: Celda de día con ocupación
- **WHEN** una habitación tiene una reserva, retención o bloqueo vigente en un día del rango visible
- **THEN** el sistema muestra un chip por esa habitación dentro de la celda de ese día

#### Scenario: Distinción visual por tipo
- **WHEN** el calendario muestra una reserva, una retención y un bloqueo en el mismo rango
- **THEN** cada uno usa un color y patrón distintos entre sí (reserva por estado, retención, bloqueo), y el color nunca es la única señal: cada tipo también se distingue por texto o ícono

#### Scenario: Origen del canal
- **WHEN** un chip corresponde a una reserva, que siempre tiene un origen registrado (website, airbnb, booking, phone, whatsapp, admin)
- **THEN** el sistema muestra un ícono identificable de ese origen en el chip o en su detalle

#### Scenario: Celda con más chips de los que caben
- **WHEN** las habitaciones ocupadas en un día no caben como chips legibles dentro de la celda
- **THEN** el sistema trunca la lista y muestra un indicador de cantidad adicional que abre el detalle de ese día en vez de listar todo dentro de la celda

### Requirement: Timeline por habitación (Próximos 7 días)
El sistema SHALL presentar el calendario en la vista Próximos 7 días como una vista de habitaciones (filas) por días (columnas), donde cada reserva, retención o bloqueo se representa como una barra sobre el intervalo de fechas que ocupa. Esta vista no aplica a Mes, Semana ni 2 semanas, que usan la grilla de calendario clásica.

#### Scenario: Barra de reserva
- **WHEN** una reserva confirmada cubre parte del rango visible de Próximos 7 días para una habitación
- **THEN** el sistema dibuja una barra continua desde el check-in hasta el check-out de esa reserva en la fila de la habitación correspondiente

#### Scenario: Distinción visual por tipo
- **WHEN** el timeline de Próximos 7 días muestra una reserva, una retención y un bloqueo
- **THEN** cada uno usa un color y patrón distintos entre sí, con la misma semántica visual que la grilla de calendario clásica

#### Scenario: Origen del canal
- **WHEN** una barra corresponde a una reserva, que siempre tiene un origen registrado (website, airbnb, booking, phone, whatsapp, admin)
- **THEN** el sistema muestra un ícono identificable de ese origen en la barra o en su detalle

### Requirement: Vista mobile como agenda
El sistema SHALL reemplazar el timeline horizontal por una agenda vertical agrupada por día cuando el ancho de pantalla es móvil, evitando cualquier desplazamiento horizontal de la página.

#### Scenario: Apertura en teléfono
- **WHEN** un administrador abre `/admin/calendario` en una pantalla móvil
- **THEN** el sistema presenta los días del rango como secciones verticales, cada una listando las habitaciones ocupadas o disponibles ese día, sin scroll horizontal

### Requirement: Navegación de rango
El sistema SHALL permitir elegir entre cuatro rangos de visualización — Semana, 2 semanas, Próximos 7 días y Mes — con Mes como rango por defecto, y SHALL permitir avanzar o retroceder dentro del rango elegido y saltar directamente a "Hoy".

#### Scenario: Carga inicial
- **WHEN** un administrador abre el calendario sin parámetros de rango en la URL
- **THEN** el sistema muestra la vista Mes centrada en el mes actual

#### Scenario: Cambio de preset
- **WHEN** el administrador selecciona el preset "Próximos 7 días"
- **THEN** el sistema muestra los 7 días siguientes a la fecha actual, comenzando hoy, en lugar del mes calendario

#### Scenario: Navegar y volver a hoy
- **WHEN** el administrador avanza varios periodos y luego presiona "Hoy"
- **THEN** el sistema vuelve al rango que incluye la fecha actual sin cambiar el preset seleccionado

### Requirement: Granularidad semanal comprimida en vista Mes
El sistema SHALL ofrecer, dentro de la vista Mes, una alternancia entre la grilla de calendario detallada (celdas por día con chips) y una granularidad semanal comprimida, donde cada semana se representa como una fila que muestra el porcentaje de ocupación de esa semana por habitación.

#### Scenario: Activar semanal comprimida
- **WHEN** el administrador activa la granularidad semanal comprimida en la vista Mes
- **THEN** el sistema reemplaza la grilla diaria detallada por una tabla de habitaciones por semana, cada celda mostrando el porcentaje de ocupación de la habitación en esa semana

#### Scenario: Expandir una semana
- **WHEN** el administrador selecciona una columna semanal comprimida
- **THEN** el sistema muestra la vista diaria de esa semana específica

### Requirement: Indicadores visuales de hoy y fin de semana
El sistema SHALL destacar visualmente la columna o sección correspondiente a la fecha actual y SHALL diferenciar visualmente los días de fin de semana del resto de los días visibles.

#### Scenario: Hoy dentro del rango visible
- **WHEN** la fecha actual está dentro del rango mostrado
- **THEN** el sistema marca la celda, columna o sección correspondiente (según la vista activa: grilla clásica, timeline de Próximos 7 días, o agenda en mobile) con un indicador visual distinto al resto

#### Scenario: Fin de semana
- **WHEN** el rango visible incluye sábados y domingos
- **THEN** el sistema aplica un tratamiento visual (por ejemplo, sombreado de fondo) que distingue esos días de los días de semana, ya sea por columna (grilla clásica y timeline) o por sección (agenda mobile)

### Requirement: Filtros por habitación y origen
El sistema SHALL permitir filtrar el calendario por habitación y por origen de reserva, reflejando la selección en los parámetros de la URL de forma consistente con los filtros existentes en la sección Reservas.

#### Scenario: Filtrar por habitación
- **WHEN** el administrador selecciona una habitación específica en el filtro
- **THEN** el sistema muestra únicamente esa habitación (como chip único por día en la grilla clásica, fila única en el timeline de Próximos 7 días, o entrada única en la agenda), y la selección queda reflejada en la URL

#### Scenario: Filtrar por origen
- **WHEN** el administrador selecciona uno o más orígenes en el filtro
- **THEN** el sistema muestra únicamente las reservas de esos orígenes, sin ocultar las retenciones ni los bloqueos (que no tienen origen registrado)

### Requirement: Creación rápida desde una celda vacía
El sistema SHALL permitir iniciar la creación de una reserva o un bloqueo manual a partir de una celda, día o sección vacía del calendario, precargando al menos la fecha seleccionada en el formulario correspondiente ya existente, y precargando también la habitación cuando la selección identifica una habitación específica.

#### Scenario: Crear desde una celda de habitación vacía (timeline o agenda)
- **WHEN** el administrador selecciona una celda vacía de una habitación específica en una fecha determinada (timeline de Próximos 7 días o agenda mobile)
- **THEN** el sistema ofrece las opciones de crear una reserva manual o un bloqueo, y al elegir una, abre el formulario correspondiente con esa habitación y fecha precargadas

#### Scenario: Crear desde un día de la grilla clásica sin filtro de habitación
- **WHEN** el administrador selecciona un área vacía de una celda de día en la grilla de calendario clásica (Mes, Semana o 2 semanas) sin un filtro de habitación activo
- **THEN** el sistema ofrece las opciones de crear una reserva manual o un bloqueo con esa fecha precargada, y la habitación se selecciona en el formulario correspondiente

#### Scenario: Crear desde un día de la grilla clásica con filtro de habitación activo
- **WHEN** el administrador selecciona un área vacía de una celda de día en la grilla de calendario clásica mientras el filtro de habitación está limitado a una habitación específica
- **THEN** el sistema precarga esa habitación además de la fecha en el formulario correspondiente

### Requirement: Panel de detalle desde una celda ocupada
El sistema SHALL mostrar un panel de detalle con la información esencial de la reserva, retención o bloqueo al seleccionar un chip, barra o sección ocupada, con acceso directo a su vista completa.

#### Scenario: Ver detalle de una reserva
- **WHEN** el administrador selecciona el chip o la barra de una reserva
- **THEN** el sistema muestra en un panel el huésped, la habitación, las fechas, el origen y el estado, junto con un enlace a la vista completa de esa reserva

#### Scenario: Ver detalle de un bloqueo
- **WHEN** el administrador selecciona el chip o la barra de un bloqueo
- **THEN** el sistema muestra en el panel la habitación, las fechas y el motivo del bloqueo, junto con un enlace a su vista completa

### Requirement: Movimiento perceptible pero respetuoso de accesibilidad
El sistema SHALL animar las transiciones de navegación de rango, la aparición de elementos del calendario y la apertura del panel de detalle, y SHALL suprimir o reducir esas animaciones cuando el sistema operativo indica preferencia por movimiento reducido.

#### Scenario: Navegación entre rangos
- **WHEN** el administrador cambia de un periodo al siguiente o anterior
- **THEN** el sistema anima la transición de forma direccional (coherente con avanzar o retroceder en el tiempo)

#### Scenario: Preferencia de movimiento reducido
- **WHEN** el sistema operativo del administrador tiene activada la preferencia de movimiento reducido
- **THEN** el calendario muestra los mismos cambios de estado sin animaciones de desplazamiento, escala o rebote
