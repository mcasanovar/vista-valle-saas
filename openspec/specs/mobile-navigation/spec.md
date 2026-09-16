# mobile-navigation Specification

## Purpose

Garantizar que la navegación móvil pública sea utilizable, accesible y visualmente contenida en pantallas pequeñas, especialmente cuando el menú se encuentra abierto.

## Requirements

### Requirement: Menú móvil contenido en el viewport
El sistema SHALL mostrar el menú de navegación móvil completamente dentro del viewport disponible, sin recortar enlaces ni generar desplazamiento horizontal en la página.

#### Scenario: Menú abierto en un teléfono estrecho
- **WHEN** un visitante abre la navegación desde una pantalla móvil estrecha
- **THEN** el panel completo permanece visible dentro del viewport, sus enlaces no quedan ocultos y la página no presenta overflow horizontal

### Requirement: Acciones de cabecera móvil
En pantallas móviles, el sistema SHALL mostrar el control de navegación como la acción más a la derecha de la cabecera junto al control de tema, SHALL ocultar el CTA de reserva duplicado de la cabecera y SHALL mantener el acceso a reservar en el contenido principal.

#### Scenario: Cabecera móvil compacta
- **WHEN** un visitante abre el sitio desde una pantalla móvil
- **THEN** la cabecera muestra la marca, el control de tema y el control de navegación sin mostrar un segundo botón de reserva en esa cabecera

#### Scenario: Panel alineado al borde derecho
- **WHEN** el visitante abre el menú móvil
- **THEN** el panel se despliega alineado al borde derecho del viewport, sin quedar desplazado por el ancho de la cabecera ni recortarse por el borde izquierdo

### Requirement: Controles accesibles del menú
El sistema SHALL proporcionar un control de apertura y cierre identificable por tecnologías de asistencia, con estado expandido correcto y un objetivo táctil suficiente.

#### Scenario: Apertura del menú
- **WHEN** el visitante activa el control de navegación móvil
- **THEN** el sistema abre el menú, expone su estado como expandido y mantiene visible el control para cerrarlo

#### Scenario: Cierre del menú
- **WHEN** el visitante activa el control de cierre, pulsa `Escape` o selecciona un enlace de navegación
- **THEN** el sistema cierra el menú y devuelve el foco al control que lo abrió cuando corresponda

### Requirement: Foco y desplazamiento durante la navegación
El sistema SHALL gestionar el foco y el desplazamiento del documento para que el menú abierto pueda operarse por teclado sin perder el contexto ni desplazar el contenido subyacente accidentalmente.

#### Scenario: Navegación por teclado
- **WHEN** una persona abre el menú y navega mediante teclado
- **THEN** el foco permanece en controles y enlaces disponibles del menú, es visible y no se mueve a contenido oculto detrás del panel

#### Scenario: Menú abierto con contenido largo
- **WHEN** el menú móvil permanece abierto mientras la persona interactúa con él
- **THEN** el documento subyacente no se desplaza y el panel permite acceder a todos sus enlaces sin salir de sus límites visuales
