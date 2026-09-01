## Why

El buscador de disponibilidad ubicado bajo el hero funciona correctamente, pero hoy se percibe como un formulario genérico separado de la identidad visual de Vista Valle. La referencia `proposes/propuesta-mejora-buscador.jpeg` propone una tarjeta de búsqueda integrada al hero, con mayor jerarquía visual, mejor agrupación de campos y una acción principal más clara.

## What Changes

- Rediseñar visualmente el buscador de disponibilidad para integrarlo con el borde inferior del hero mediante una tarjeta elevada, clara y consistente con la marca.
- Presentar fecha de entrada, fecha de salida, huéspedes y acción principal con una composición horizontal compacta en escritorio.
- Incorporar iconografía contextual para fechas y huéspedes sin reemplazar labels ni nombres accesibles.
- Ajustar bordes, radios, sombras, separadores, espaciado, tamaños táctiles y contraste para aproximar la referencia visual.
- Mantener el estado ocupado, errores, criterios preseleccionados, validación y navegación existentes.
- Adaptar la composición a móvil y tablet sin overflow horizontal ni controles superpuestos.
- Verificar el resultado con pruebas visuales, responsive, accesibilidad y regresión de la consulta de disponibilidad.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `availability-search-experience`: actualizar la presentación responsive y accesible del buscador bajo el hero, manteniendo intacto su contrato funcional de consulta, validación, estados y navegación.

## Impact

- Componentes de presentación del hero, la sección de búsqueda y el formulario reutilizado en la página de disponibilidad.
- Tokens o clases de estilo existentes para superficies, bordes, sombras, tipografía, iconos y responsive.
- Pruebas E2E de accesibilidad, screenshots responsive, navegación de disponibilidad y ausencia de overflow.
- No se modifican endpoints, contratos de disponibilidad, cálculo de resultados, persistencia ni proveedores externos.
