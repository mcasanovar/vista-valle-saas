## Context

El landing ya compone `Hero`, la sección `#consulta-disponibilidad` y el buscador reutilizable que también aparece en `/disponibilidad`. La referencia visual está en `proposes/propuesta-mejora-buscador.jpeg`: una tarjeta clara, elevada y superpuesta al borde inferior del hero, con campos agrupados horizontalmente, iconos contextuales y una acción primaria oscura.

La consulta sigue siendo un flujo cliente que valida criterios y navega a `/disponibilidad`; este cambio no modifica ese contrato ni las fuentes mock de disponibilidad. El buscador también debe seguir siendo reutilizable en la página de resultados, donde no existe un hero.

## Goals / Non-Goals

**Goals:**

- Crear una presentación específica para el buscador inicial, integrada visualmente al hero y coherente con los tokens existentes.
- Mantener una variante compacta y estable para el buscador de resultados.
- Dar a fechas y huéspedes una jerarquía visual clara mediante iconos decorativos complementarios, labels persistentes y controles táctiles de al menos 44 px.
- Definir estados visuales consistentes para foco, error, ocupado, disabled y hover en claro y oscuro.
- Garantizar una transición responsive: fila horizontal en laptop/escritorio, composición de dos columnas cuando sea posible y una columna en móvil.
- Mantener el contenido semántico, el orden de foco, los nombres accesibles y el funcionamiento de los criterios ocultos como `guests` y `room`.

**Non-Goals:**

- No cambiar validaciones, límites, serialización de URL, navegación ni cálculo de disponibilidad.
- No modificar habitaciones, precios, persistencia, APIs ni proveedores externos.
- No convertir el buscador en un modal, wizard o control dependiente únicamente de iconos.
- No reemplazar la imagen del hero ni rediseñar el resto del landing más allá del espacio necesario para alojar la tarjeta.

## Decisions

### Variante de presentación en el componente reutilizable

Se añadirá una variante de presentación para distinguir el buscador del hero del buscador de resultados, manteniendo una única composición funcional y una única fuente de labels/errores. La variante inicial aplicará la tarjeta elevada, radios amplios, padding generoso, separadores verticales y CTA de mayor presencia; la variante de resultados conservará una densidad compacta.

Alternativa considerada: duplicar el formulario para cada página. Se descarta porque duplicaría estados, accesibilidad y reglas de serialización, aumentando el riesgo de divergencia.

### Iconografía complementaria

Las fechas mostrarán un icono de calendario y huéspedes un icono de persona dentro de superficies suaves. Los iconos serán decorativos cuando el label visible ya comunique el significado, por lo que no reemplazarán labels ni añadirán ruido al árbol accesible. El icono nativo del input date se conservará como affordance del control.

Alternativa considerada: usar solo placeholders e iconos. Se descarta por accesibilidad y por la pérdida de contexto cuando el campo recibe foco o contiene un valor.

### Composición y responsive

En laptop y escritorio la tarjeta se mantendrá superpuesta al hero mediante el contenedor existente, con una cuadrícula/flex horizontal para entrada, salida, huéspedes y CTA. Cada grupo tendrá un ancho mínimo legible y los separadores no serán la única forma de comunicar agrupación.

En tablet se permitirá una composición de dos columnas con el CTA ocupando el espacio necesario. En móvil la tarjeta pasará a una columna, conservará el solapamiento solo cuando no oculte contenido importante del hero y usará espaciado reducido sin comprimir los objetivos táctiles.

Alternativa considerada: mantener una fila horizontal con scroll en móvil. Se descarta porque introduce overflow y dificulta completar la consulta.

### Estados y movimiento

Los estilos se construirán con las variables/clases semánticas existentes para superficie, borde, texto, foco y estados. El estado ocupado seguirá siendo comunicado por `aria-busy`, el botón loading y el anuncio existente; la mejora visual no añadirá animaciones imprescindibles. Cualquier transición decorativa respetará `prefers-reduced-motion`.

### Verificación visual

Se actualizarán o añadirán pruebas que cubran la tarjeta en 320, tablet, laptop y escritorio, además de contraste/axe, navegación con teclado, foco visible, errores y estado ocupado. Las capturas de referencia se actualizarán solo después de verificar que el layout no depende de una condición de desarrollo o del estado persistido del tema.

## Risks / Trade-offs

- [Riesgo] El solapamiento puede ocultar el siguiente contenido o el foco en pantallas pequeñas → limitar el negativo del contenedor por breakpoint y verificar alturas/overflow en 320 px.
- [Riesgo] Cambiar estilos compartidos puede alterar el buscador de resultados → encapsular la presentación del hero en una variante y ejecutar regresión de `/disponibilidad`.
- [Riesgo] Iconos o placeholders pueden reducir contraste en dark mode → usar tokens semánticos, revisar estados claro/oscuro y ejecutar axe en ambos contextos si la infraestructura lo permite.
- [Riesgo] Inputs de fecha nativos difieren entre navegadores → conservar el input nativo y validar la composición alrededor del control, no su icono interno.
- [Riesgo] Las screenshots pueden capturar estados de hidratación o overlays de desarrollo → esperar fuentes/estabilidad visual y no incluir indicadores del dev server en snapshots aprobados.

## Migration Plan

1. Implementar la variante visual y los estilos responsivos detrás del componente de búsqueda existente.
2. Ajustar la composición del landing para que la tarjeta se ubique en el borde inferior del hero.
3. Mantener la variante de resultados y ejecutar pruebas unitarias/E2E, accesibilidad y snapshots responsive.
4. Si la regresión visual o funcional es negativa, retirar la variante nueva y restaurar las clases del contenedor; no requiere migración de datos ni rollback de APIs.

## Open Questions

No hay preguntas abiertas que cambien el alcance: la imagen de referencia define la dirección visual y el comportamiento funcional existente se conserva.
