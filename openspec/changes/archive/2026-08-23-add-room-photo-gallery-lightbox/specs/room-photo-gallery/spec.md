## Purpose

Permite a los visitantes explorar todas las fotografías de una habitación en un carrusel de pantalla completa, accesible desde las tarjetas de habitación y desde la página de detalle, sin abandonar la página en la que se encuentran.

## ADDED Requirements

### Requirement: Apertura del carrusel desde la tarjeta de habitación
El sistema SHALL abrir un carrusel de fotos al presionar la imagen principal de una tarjeta de habitación en la página de inicio, en el catálogo de habitaciones o en los resultados de disponibilidad, mostrando todas las fotos de esa habitación.

#### Scenario: Click en imagen de tarjeta
- **WHEN** un visitante presiona la imagen principal de una tarjeta de habitación
- **THEN** el sistema abre un carrusel con todas las fotos de esa habitación, iniciando en la foto principal

### Requirement: Apertura del carrusel desde la galería de detalle
El sistema SHALL abrir el mismo carrusel de fotos al presionar cualquier foto de la galería en la página de detalle de una habitación, iniciando en la foto seleccionada.

#### Scenario: Click en foto de la galería de detalle
- **WHEN** un visitante presiona una foto dentro de la galería de la página de detalle
- **THEN** el sistema abre el carrusel mostrando todas las fotos de la habitación, iniciando en la foto presionada

### Requirement: Navegación dentro del carrusel
El sistema SHALL permitir avanzar y retroceder entre las fotos de la habitación mientras el carrusel está abierto, mediante controles visibles y mediante teclado.

#### Scenario: Avance con controles
- **WHEN** el carrusel está abierto y el visitante activa el control "siguiente" o "anterior"
- **THEN** el sistema muestra la foto correspondiente sin cerrar el carrusel

#### Scenario: Navegación por teclado
- **WHEN** el carrusel está abierto y el visitante presiona las teclas de flecha izquierda o derecha
- **THEN** el sistema muestra la foto anterior o siguiente respectivamente

### Requirement: Carrusel deep-linkable
El sistema SHALL reflejar el estado abierto del carrusel y la foto activa en la URL de la página actual, de modo que el enlace sea compartible y el botón "atrás" del navegador cierre el carrusel sin abandonar la página.

#### Scenario: Compartir enlace directo
- **WHEN** un visitante abre una URL que incluye el estado del carrusel para una habitación
- **THEN** el sistema presenta la página con el carrusel ya abierto en la foto correspondiente

#### Scenario: Cierre con navegación "atrás"
- **WHEN** el carrusel está abierto y el visitante activa "atrás" en el navegador
- **THEN** el sistema cierra el carrusel y muestra la página original sin recargarla ni cambiar de ruta

### Requirement: Cierre del carrusel
El sistema SHALL permitir cerrar el carrusel mediante un control explícito, la tecla Escape o al presionar fuera del área de la foto, devolviendo el foco al elemento que lo abrió.

#### Scenario: Cierre explícito
- **WHEN** el carrusel está abierto y el visitante activa el control de cierre o presiona Escape
- **THEN** el sistema cierra el carrusel y devuelve el foco al elemento que lo abrió

### Requirement: Contenido exclusivamente fotográfico
El sistema SHALL presentar en el carrusel únicamente las fotografías de la habitación, sin texto descriptivo ni información comercial adicional.

#### Scenario: Fotos sin descripción
- **WHEN** el carrusel muestra una foto
- **THEN** el sistema no incluye texto descriptivo ni datos comerciales sobre esa foto, más allá del texto alternativo de accesibilidad

### Requirement: Accesibilidad del carrusel
El sistema SHALL exponer el carrusel como un diálogo accesible con foco atrapado dentro de él mientras está abierto, texto alternativo en cada foto y controles operables por teclado.

#### Scenario: Uso con lector de pantalla
- **WHEN** un visitante que usa un lector de pantalla abre el carrusel
- **THEN** el sistema anuncia el diálogo, mantiene el foco dentro de él y describe cada foto mediante su texto alternativo
