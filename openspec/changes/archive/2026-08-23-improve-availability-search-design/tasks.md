## 1. Composición visual y contrato de presentación

- [x] 1.1 Revisar la referencia `proposes/propuesta-mejora-buscador.jpeg`, los tokens existentes y los estados actuales del buscador, y documentar la matriz visual de hero/resultados, breakpoints, superficies, foco, error y ocupado; verificar que no se introduzcan cambios al contrato de consulta.
- [x] 1.2 Definir la variante de presentación del buscador inicial frente a la variante compacta de resultados, preservando labels, nombres de campos, criterios ocultos, `aria-busy` y el orden de foco; verificar que ambas páginas sigan usando el mismo flujo de validación y navegación.

## 2. Implementación de la interfaz

- [x] 2.1 Implementar la tarjeta elevada del buscador inicial con superficie, radios, sombra, separadores, espaciado y CTA alineados a los tokens de Vista Valle; verificar visualmente la composición superpuesta al borde inferior del hero en escritorio.
- [x] 2.2 Incorporar iconos decorativos de calendario y huéspedes como apoyo visual sin reemplazar labels ni affordances nativas; verificar con inspección accesible que los iconos no agreguen nombres redundantes.
- [x] 2.3 Ajustar la composición del landing y los breakpoints para fila horizontal en escritorio, distribución equilibrada en tablet y una columna en móvil desde 320 px; verificar ausencia de overflow, solapamientos y pérdida del CTA.
- [x] 2.4 Mantener estados de foco, hover, disabled, error, loading y reduced motion en tema claro y oscuro; verificar operación con teclado, contraste automatizado y anuncio de estado ocupado.

## 3. Verificación integrada

- [x] 3.1 Actualizar o añadir pruebas visuales responsive para 320, tablet, laptop y escritorio usando la referencia como guía; verificar screenshots estables sin overlays de desarrollo ni dependencia del estado persistido del tema.
- [x] 3.2 Ejecutar regresión E2E de búsqueda válida, búsqueda inválida, criterios preseleccionados, navegación a resultados e historial; verificar que la presentación nueva no altere la URL ni los estados de disponibilidad.
- [x] 3.3 Ejecutar accesibilidad, typecheck, lint, formato y build; verificar con `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check` y `npm run build:test`.
