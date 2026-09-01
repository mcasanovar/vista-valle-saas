## MODIFIED Requirements

### Requirement: Estados recuperables de ausencia y error
La página de disponibilidad SHALL mantener accesible el buscador y los criterios consultados cuando no existan resultados, cuando una habitación preseleccionada no esté disponible o cuando la consulta falle, SHALL ofrecer una acción de recuperación aplicable sin inventar disponibilidad y SHALL comunicar toda validación o error visible al visitante en español claro sin exponer textos técnicos.

#### Scenario: Sin habitaciones disponibles
- **WHEN** ninguna habitación satisface las fechas y la cantidad de huéspedes
- **THEN** el sistema explica que no hay disponibilidad y permite ajustar fechas o huéspedes desde el buscador visible

#### Scenario: Habitación preseleccionada no disponible
- **WHEN** la habitación preseleccionada no está disponible o no admite la cantidad indicada
- **THEN** el sistema identifica esa condición y permite modificar la búsqueda o retirar la preselección sin presentar la habitación como disponible

#### Scenario: Fallo de consulta
- **WHEN** la fuente de disponibilidad devuelve un error inesperado
- **THEN** el sistema conserva los criterios, comunica el fallo sin datos sensibles y en español, y ofrece reintentar la misma consulta

#### Scenario: URL incompleta o inválida
- **WHEN** el visitante abre la página de disponibilidad sin todos los criterios válidos
- **THEN** el sistema presenta el buscador con errores específicos en español y no muestra resultados como si fueran válidos
