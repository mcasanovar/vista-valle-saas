## MODIFIED Requirements

### Requirement: Vista de calendario clásica (Mes, Semana, 2 semanas)
El sistema SHALL presentar el calendario en las vistas Mes, Semana y 2 semanas como una grilla de calendario clásica en pantallas desktop y tablet: columnas fijas de lunes a domingo, una fila por cada semana del rango visible, y el número de día mostrado en tamaño reducido en la esquina superior derecha de cada celda sin ocupar el cuadro completo. Cada habitación ocupada ese día SHALL representarse como un chip dentro de la celda.

#### Scenario: Celda de día con ocupación
- **WHEN** una habitación tiene una reserva, retención o bloqueo vigente en un día del rango visible
- **THEN** el sistema muestra un chip por esa habitación dentro de la celda de ese día

#### Scenario: Distinción visual por tipo
- **WHEN** el calendario muestra una reserva, una retención y un bloqueo en el mismo rango
- **THEN** retención y bloqueo cada uno usa un color y patrón distintos entre sí y distintos de una reserva, y el color nunca es la única señal: cada tipo también se distingue por texto o ícono
- **THEN** el chip de una reserva SHALL usar el color de pagada si tiene al menos un pago con estado `approved`, y el color de no pagada en cualquier otro caso (sin pagos, `pending`, `rejected`, `requires_action`, u otro estado distinto de `approved`)

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
- **THEN** retención y bloqueo cada uno usa un color y patrón distintos entre sí y distintos de una reserva, con la misma semántica visual que la grilla de calendario clásica
- **THEN** la barra de una reserva usa el mismo color de pagada/no pagada definido para la grilla de calendario clásica, según si tiene al menos un pago `approved`

#### Scenario: Origen del canal
- **WHEN** una barra corresponde a una reserva, que siempre tiene un origen registrado (website, airbnb, booking, phone, whatsapp, admin)
- **THEN** el sistema muestra un ícono identificable de ese origen en la barra o en su detalle
