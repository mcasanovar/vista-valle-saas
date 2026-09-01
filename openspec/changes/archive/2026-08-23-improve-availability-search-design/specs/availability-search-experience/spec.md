## ADDED Requirements

### Requirement: Buscador integrado visualmente al hero
La página de inicio SHALL presentar el buscador de disponibilidad como una tarjeta elevada que se integra visualmente con el borde inferior del hero, usando las superficies, tipografía, radios, sombras, separadores e iconografía coherentes con la identidad de Vista Valle.

#### Scenario: Composición en escritorio
- **WHEN** el visitante abre la página de inicio en una pantalla amplia
- **THEN** el buscador aparece superpuesto al borde inferior del hero en una composición horizontal con fecha de entrada, fecha de salida, huéspedes y “Consultar disponibilidad” claramente diferenciados

#### Scenario: Campos reconocibles
- **WHEN** el visitante revisa el buscador
- **THEN** cada campo conserva un label visible, un control táctil identificable y, cuando corresponda, un icono contextual de calendario o huésped sin depender del icono para comunicar su significado

#### Scenario: Acción principal visible
- **WHEN** el visitante completa o revisa los criterios de búsqueda
- **THEN** la acción “Consultar disponibilidad” mantiene una jerarquía visual primaria, contraste suficiente y un estado ocupado visible durante la navegación

### Requirement: Presentación responsive del buscador integrado
El buscador SHALL conservar su integración con el hero y su legibilidad al cambiar de viewport, reorganizando sus controles sin overflow horizontal, solapamientos ni pérdida de información.

#### Scenario: Composición móvil
- **WHEN** el visitante abre la página en una pantalla de 320 píxeles o más estrecha
- **THEN** la tarjeta se adapta a una disposición vertical o compacta, mantiene todos los labels y controles operables y no requiere desplazamiento horizontal

#### Scenario: Composición intermedia
- **WHEN** el visitante usa una pantalla tablet
- **THEN** los campos se distribuyen en una composición equilibrada que mantiene la tarjeta visualmente conectada al hero y evita que la acción principal quede escondida

#### Scenario: Preferencias de movimiento y contraste
- **WHEN** el visitante solicita movimiento reducido o utiliza contraste aumentado del sistema
- **THEN** la presentación evita animaciones no esenciales y conserva estados, bordes, foco y texto distinguibles

## MODIFIED Requirements

### Requirement: Experiencia responsive, accesible y estable
La página de disponibilidad SHALL ser utilizable desde 320 píxeles hasta escritorio, SHALL mantener el buscador integrado al contexto visual del hero en la página de inicio y compacto en la parte superior de resultados, SHALL mantener orden semántico, labels visibles, foco identificable, controles táctiles accesibles, anuncios comprensibles para tecnologías de asistencia y espacio reservado para imágenes y contenido asíncrono.

#### Scenario: Resultados en pantalla móvil
- **WHEN** el visitante consulta desde una pantalla móvil
- **THEN** el buscador y las habitaciones se presentan en una sola columna sin desplazamiento horizontal ni controles superpuestos

#### Scenario: Resultados en pantalla amplia
- **WHEN** el visitante consulta desde una pantalla de tablet o escritorio
- **THEN** el buscador se presenta de forma compacta en la parte superior y las habitaciones aprovechan una grilla legible sin alterar el orden del contenido

#### Scenario: Buscador inicial en pantalla amplia
- **WHEN** el visitante abre el landing en una pantalla de tablet o escritorio
- **THEN** el buscador se presenta como una tarjeta elevada integrada al borde inferior del hero, con sus campos y acción principal alineados de forma legible

#### Scenario: Buscador de resultados en pantalla amplia
- **WHEN** el visitante consulta desde una pantalla de tablet o escritorio
- **THEN** el buscador de la página de disponibilidad se presenta de forma compacta en la parte superior y las habitaciones aprovechan una grilla legible sin alterar el orden del contenido

#### Scenario: Consulta mediante teclado y lector de pantalla
- **WHEN** el visitante navega, modifica criterios y revisa resultados sin ratón
- **THEN** puede operar todos los controles, identificar el estado ocupado y recibir el resultado de la consulta sin que el foco quede oculto o se desplace de forma inesperada
