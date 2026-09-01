## Purpose

Guiar al huésped desde la selección de habitaciones hasta una pre-reserva clara, persistente y accesible antes de confirmar la reserva.

## ADDED Requirements

### Requirement: Carro de reservas flotante
El sistema SHALL mostrar un carro de reservas flotante y sticky en las páginas públicas donde el huésped agrega habitaciones, solo cuando exista al menos una habitación seleccionada. El carro SHALL mostrar cantidad de habitaciones, subtotal agregado y un acceso visible a la pre-reserva. En escritorio SHALL usar la composición de la referencia aprobada: una cápsula inferior centrada, de superficie cálida, bordes ampliamente redondeados y elevación suave, dividida en tres zonas por separadores verticales visibles: identidad del carro con icono y badge de cantidad; resumen de ítems; y subtotal con CTA de alto contraste.

#### Scenario: Carro con selección activa
- **WHEN** el huésped tiene una o más habitaciones seleccionadas
- **THEN** el sistema muestra el carro en el borde inferior sin ocultar controles esenciales ni contenido al desplazarse
- **AND** en escritorio se distinguen visualmente sus tres zonas, los separadores verticales, el badge de cantidad y el CTA oscuro mediante los tokens de color, bordes y elevación establecidos por el sistema visual

#### Scenario: Vista móvil compacta
- **WHEN** el huésped visita el sitio desde una pantalla móvil
- **THEN** el carro conserva la jerarquía de cantidad, subtotal y acceso a la pre-reserva con controles táctiles accesibles y sin provocar desplazamiento horizontal
- **AND** sus zonas y separadores se reordenan o simplifican sin perder la identidad cálida y redondeada del carro ni cubrir contenido de la página

### Requirement: Animación de agregado con alternativa accesible
El sistema SHALL comunicar visualmente el agregado de una habitación mediante una animación breve desde el origen de la acción hacia el carro y una entrada suave del carro cuando se vuelve visible o aumenta su cantidad. La selección SHALL actualizarse inmediatamente, sin una recarga de documento ni un salto de desplazamiento, y la animación SHALL NO bloquear nuevos controles ni definir el estado de la reserva.

#### Scenario: Agregar desde resultados o detalle
- **WHEN** el huésped agrega una habitación disponible desde resultados o desde su detalle
- **THEN** el carro refleja de inmediato la selección y se muestra una animación que comunica el traslado hacia el carro
- **AND** la vista mantiene su posición de lectura mientras el carro aparece o actualiza su contenido de forma suave

#### Scenario: Viaje de agregado con continuidad espacial
- **WHEN** el huésped agrega una habitación
- **THEN** la representación de la acción parte con el tamaño aproximado de su botón, se dirige al centro del carro con una duración perceptible y se reduce progresivamente al acercarse

#### Scenario: Movimiento reducido
- **WHEN** la persona tiene activada la preferencia de reducir movimiento
- **THEN** el sistema omite el desplazamiento animado y comunica el agregado mediante un cambio de estado visible y anunciado de forma accesible

### Requirement: Página de pre-reserva
El sistema SHALL proporcionar la ruta pública `/pre-reserva` para revisar antes de confirmar las habitaciones seleccionadas, fechas compartidas, noches, subtotales, total, datos del titular y la solicitud opcional de factura.

#### Scenario: Revisión antes de confirmar
- **WHEN** el huésped selecciona el acceso del carro
- **THEN** llega a `/pre-reserva` y puede revisar o quitar habitaciones antes de confirmar la reserva

#### Scenario: Factura en pre-reserva
- **WHEN** el huésped activa solicitar factura en la pre-reserva
- **THEN** el sistema muestra y exige los antecedentes tributarios definidos para la solicitud antes de permitir confirmar

#### Scenario: Fechas informativas en pre-reserva
- **WHEN** el huésped abre una pre-reserva con fechas válidas
- **THEN** el sistema presenta entrada y salida como un resumen de solo lectura
- **AND** no muestra una acción para actualizar ni editar fechas desde esta página
- **AND** la búsqueda de un rango distinto continúa desde la página inicial

### Requirement: Conservación y revalidación de la selección
El sistema SHALL conservar la selección y las fechas al navegar entre landing, resultados, detalle de habitación y pre-reserva, incluso tras una recarga del navegador durante la misma sesión de reserva. La representación compartible de URL SHALL seguir reflejando el estado cuando esté disponible; el contexto persistente SHALL almacenar únicamente identificadores de habitación y fechas, no datos personales, y SHALL limpiarse tras confirmar la reserva. Al modificar las fechas, SHALL revalidar todas las habitaciones seleccionadas y SHALL impedir continuar con cualquier habitación que ya no esté disponible.

#### Scenario: Habitación deja de estar disponible
- **WHEN** una habitación seleccionada deja de estar disponible para las fechas actuales
- **THEN** la pre-reserva identifica la habitación afectada y exige retirarla o ajustar las fechas antes de confirmar

#### Scenario: Regreso al landing con selección activa
- **WHEN** el huésped agrega una habitación, vuelve al landing y busca/agrega otra habitación para el mismo rango de fechas
- **THEN** ambas habitaciones permanecen en el carro y en la pre-reserva hasta que el huésped las retire o confirme la reserva

### Requirement: Disponibilidad requerida para agregar desde detalle
El sistema SHALL permitir agregar una habitación desde su página de detalle únicamente cuando exista un rango de fechas válido en el contexto de reserva. Sin fechas válidas, SHALL mostrar una acción para consultar disponibilidad en lugar de agregar a la reserva.

#### Scenario: Detalle directo sin fechas
- **WHEN** el huésped abre directamente el detalle de una habitación sin fechas de reserva válidas
- **THEN** no puede agregar la habitación y recibe una acción visible para consultar disponibilidad

#### Scenario: Detalle con fechas seleccionadas
- **WHEN** el huésped abre el detalle con un rango de fechas válido en el contexto de reserva
- **THEN** puede agregar la habitación al carro sin perder su selección previa

#### Scenario: No duplicar la acción de disponibilidad
- **WHEN** el huésped abre el detalle sin un rango de fechas válido
- **THEN** el sistema muestra una única acción de consultar disponibilidad
- **AND** no muestra un segundo CTA de disponibilidad en la posición reservada para acciones de selección

### Requirement: Estado de habitación agregada
El sistema SHALL reemplazar la acción de agregar de una habitación seleccionada por un mensaje claro de que ya está agregada y una acción para quitarla. Al quitarla, SHALL restaurar las acciones aplicables para el contexto actual.

#### Scenario: Habitación ya en el carro
- **WHEN** una habitación se encuentra seleccionada
- **THEN** su interfaz de selección muestra que ya está agregada y ofrece quitarla
- **AND** no vuelve a mostrar la acción de agregar hasta que la habitación sea retirada

### Requirement: Detalle desplegable integrado del carro
El sistema SHALL permitir activar el resumen de ítems del carro para que el mismo componente se expanda únicamente hacia arriba y revele su detalle integrado. El área desplegada SHALL mostrar, por cada habitación seleccionada, su nombre, cantidad de noches, valor por noche y una acción de eliminación; su altura SHALL depender del contenido real de las habitaciones seleccionadas y SHALL volver al estado compacto al activar fuera del carro, usar Escape o cambiar la selección. Las zonas ya visibles del carro SHALL permanecer centradas y visualmente equilibradas mientras el componente cambia de altura.

#### Scenario: Abrir el detalle de ítems
- **WHEN** el huésped activa el resumen de ítems agregados del carro
- **THEN** el mismo carro revela hacia arriba solo el espacio necesario para la lista integrada de detalles de sus habitaciones
- **AND** mantiene centrados el resumen, subtotal y CTA dentro de la cápsula expandida

#### Scenario: Indicador de detalle disponible
- **WHEN** el carro contiene habitaciones seleccionadas
- **THEN** el resumen de ítems muestra un indicador visible de que puede activarse para ver el detalle
- **AND** el indicador comunica visualmente si el detalle está expandido o compacto sin depender solo del color

#### Scenario: Cerrar el detalle de ítems
- **WHEN** el detalle desplegable está abierto y el huésped activa fuera del carro o presiona Escape
- **THEN** el panel se cierra y el carro vuelve suavemente a su altura compacta

#### Scenario: Quitar una habitación desde el carro
- **WHEN** el huésped activa la acción de eliminación de una habitación en el detalle del carro
- **THEN** el sistema retira inmediatamente esa habitación de la selección, actualiza el contador y el subtotal autoritativo representado en el carro
- **AND** la acción tiene un nombre accesible que identifica la habitación, además de su icono visual

#### Scenario: Quitar la última habitación desde el carro
- **WHEN** el huésped retira la única habitación seleccionada desde el detalle del carro
- **THEN** el carro desaparece y la interfaz restaura el estado sin selección

### Requirement: Navegación y semántica accesibles
El sistema SHALL permitir operar el carro, sus acciones y la página de pre-reserva mediante teclado, con foco visible, nombres accesibles y anuncio no intrusivo de los cambios de selección.

#### Scenario: Uso sin ratón
- **WHEN** una persona agrega una habitación y abre la pre-reserva mediante teclado
- **THEN** puede completar el flujo, identificar la selección y mantener una navegación de retorno predecible

#### Scenario: Detalle de ítems operable por teclado
- **WHEN** una persona usa teclado en el resumen de ítems del carro
- **THEN** puede abrir y cerrar el detalle mediante un control con estado expandido anunciado

### Requirement: Superficie visual de pre-reserva
El sistema SHALL presentar `/pre-reserva` sobre los tokens de fondo y superficie definidos por el sistema visual, manteniendo contraste y legibilidad en temas compatibles. La composición SHALL seguir la referencia aprobada: fondo marfil cálido, resumen de fechas claro y no editable, tarjetas de habitaciones y datos del huésped con superficies claras sin borde y `shadow-md`, y una franja de total tonalmente diferenciada mediante una superficie semántica cuyo valor claro aprobado es `#F4E9DF`.

#### Scenario: Revisión de pre-reserva con apariencia consistente
- **WHEN** el huésped abre `/pre-reserva`
- **THEN** la página usa fondo marfil cálido, contenedores claros sin borde con `shadow-md` y una franja de total de superficie tonal aprobada, de forma consistente con la referencia
- **AND** conserva contraste, legibilidad y reflujo sin desplazamiento horizontal en pantalla móvil
