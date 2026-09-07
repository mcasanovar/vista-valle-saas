# location-page Specification

## Purpose

Definir el comportamiento observable de la página pública `/ubicacion`, que permite a un visitante ubicar el hostal en Illapel mediante un mapa interactivo, entender su relación con la Plaza de Armas de la ciudad, y conocer información de contexto de la ciudad y de cómo llegar al recinto.

## Requirements

### Requirement: Página dedicada de ubicación
El sistema SHALL exponer una página pública en la ruta `/ubicacion`, accesible desde el ítem "Ubicación" del menú de navegación en todas las páginas públicas del sitio (incluyendo el landing).

#### Scenario: Acceso desde cualquier página pública
- **WHEN** un visitante hace clic en el ítem "Ubicación" del menú de navegación desde cualquier página pública
- **THEN** el sistema navega a `/ubicacion`

#### Scenario: Acceso desde el landing
- **WHEN** un visitante hace clic en el ítem "Ubicación" del menú de navegación estando en el landing
- **THEN** el sistema navega a `/ubicacion`, no a un ancla dentro de la misma página

### Requirement: Mapa interactivo de la ubicación
El sistema SHALL presentar en `/ubicacion` un mapa interactivo, pannable y con zoom, centrado en el sector de Illapel donde se encuentra el hostal, sin requerir ninguna clave de API ni depender de un servicio de mapas de pago.

#### Scenario: Explorar el mapa
- **WHEN** un visitante arrastra o hace zoom sobre el mapa
- **THEN** el sistema actualiza la vista mostrando las calles cercanas dentro del área del mapa, sin recargar la página

### Requirement: Marcadores del hostal y la Plaza de Armas
El sistema SHALL mostrar en el mapa un marcador en la ubicación del hostal y un marcador en la Plaza de Armas de Illapel, cada uno con una etiqueta identificable al interactuar con él.

#### Scenario: Identificar el marcador del hostal
- **WHEN** un visitante interactúa con el marcador ubicado en la dirección del hostal
- **THEN** el sistema muestra una etiqueta o popup que identifica ese punto como el hostal

#### Scenario: Identificar el marcador de la Plaza de Armas
- **WHEN** un visitante interactúa con el marcador ubicado en la Plaza de Armas
- **THEN** el sistema muestra una etiqueta o popup que identifica ese punto como la Plaza de Armas de Illapel

### Requirement: Trazado de la ruta entre la Plaza de Armas y el hostal
El sistema SHALL dibujar sobre el mapa una línea que trace el recorrido peatonal real entre la Plaza de Armas y el hostal, sin realizar ninguna llamada a un servicio externo de cálculo de rutas al momento de mostrar la página.

#### Scenario: Visualización de la ruta
- **WHEN** un visitante abre la página `/ubicacion`
- **THEN** el sistema muestra, junto con los dos marcadores, una línea continua que conecta la Plaza de Armas con el hostal siguiendo el trazado de las calles

### Requirement: Información de la ciudad y de cómo llegar
El sistema SHALL presentar en `/ubicacion`, además del mapa, un texto descriptivo sobre la ciudad de Illapel y un texto sobre la locomoción/transporte que llega al recinto.

#### Scenario: Contenido de reemplazo pendiente de aprobación
- **WHEN** el propietario aún no ha proporcionado el texto definitivo de ciudad o de locomoción
- **THEN** el sistema muestra un texto de marcador de posición (placeholder) claramente reemplazable, siguiendo el mismo criterio que el resto del contenido público pendiente de aprobación del sitio

### Requirement: Acceso desde el landing
El sistema SHALL presentar en la sección "Ubicación" del landing un resumen breve (foto y texto corto) con un enlace que dirige a `/ubicacion` para ver el mapa completo, en lugar de duplicar el mapa interactivo dentro del landing.

#### Scenario: Enlace desde el teaser del landing
- **WHEN** un visitante hace clic en el enlace de la sección "Ubicación" del landing
- **THEN** el sistema navega a `/ubicacion`
