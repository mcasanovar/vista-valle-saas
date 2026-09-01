## Context

La selección pública actual se conserva en parámetros URL y muestra un resumen dentro de disponibilidad. Véanse proposal.md y la spec de esta capacidad para los resultados esperados. La nueva experiencia debe reutilizar la selección y los contratos autoritativos existentes, sin crear una reserva ni retención antes de la confirmación final.

## Goals / Non-Goals

**Goals:**

- Separar exploración de habitaciones y revisión previa a confirmar.
- Mantener el carro consistente al navegar entre disponibilidad, detalle y pre-reserva.
- Ofrecer retroalimentación de agregado clara, rápida y respetuosa de preferencias de movimiento.

**Non-Goals:**

- Cambiar reglas de precio, disponibilidad, persistencia o confirmación de reservas.
- Añadir extras, productos o cargos comerciales no configurados.
- Convertir el carro en un almacenamiento duradero o una reserva incompleta.

## Decisions

### 1. Selección URL con contexto persistente de respaldo

El carro y `/pre-reserva` mantendrán la representación URL existente para enlaces y navegación compartible, complementada por un contexto de reserva persistido durante la sesión del navegador. Este contexto contendrá solo habitaciones y fechas, se hidratará cuando la URL no las aporte, se sincronizará con las acciones de selección y se limpiará tras confirmar una reserva. La página de pre-reserva volverá a consultar las habitaciones para el intervalo antes de mostrar la acción final; el backend seguirá siendo autoritativo al confirmar.

**Alternativa considerada:** depender solo de los parámetros de cada URL pierde la selección al volver al landing; persistir datos personales del huésped sería innecesario y amplía la exposición local.

### 2. Barra flotante como único resumen durante exploración

El resumen embebido se reemplazará por una barra fija inferior con área segura, cantidad, subtotal y CTA. En escritorio se compone como una cápsula centrada de fondo cálido, bordes ampliamente redondeados, borde sutil y sombra suave. Tendrá tres áreas claramente delimitadas con separadores verticales: (1) icono de carro dentro de una superficie tonal, badge de cantidad y etiqueta del carro; (2) resumen de ítems; (3) subtotal y CTA oscuro redondeado con indicador direccional. Todos los tonos, tipografías, bordes y elevación reutilizarán los tokens semánticos existentes del sistema, evitando una paleta paralela.

En móvil las áreas podrán reagruparse o apilarse y los separadores verticales podrán ocultarse o convertirse en separación horizontal, pero se conservarán cantidad, total, CTA, área segura y controles táctiles. El contenido de página reservará espacio para no quedar cubierto.

**Alternativa considerada:** usar un modal o panel lateral obliga a cerrar una interfaz para seguir explorando y resulta menos apropiado como navegación primaria.

### 3. Animación decorativa independiente del estado

Al agregar se actualizará inmediatamente la selección mediante navegación client-side y se animará una representación visual desde el origen al carro usando transformaciones y opacidad. La cápsula del carro tendrá una entrada o actualización breve usando las mismas propiedades, sin modificar el flujo del documento ni reiniciar el desplazamiento. Las animaciones serán cancelables, no bloquearán acciones y se reemplazarán por feedback visible y anuncio accesible bajo `prefers-reduced-motion`.

**Alternativa considerada:** retrasar el agregado hasta el fin de la animación degrada la respuesta e introduce condiciones de carrera visuales.

### 4. `/pre-reserva` como composición previa al commit

La nueva ruta compone el detalle de ítems, datos del titular, solicitud tributaria y total antes de llamar a la confirmación existente. La referencia aprobada define un fondo marfil cálido, un encabezado de serif de alto contraste, una franja superior clara para entrada y salida, tarjetas claras de habitaciones y datos del huésped sin borde con `shadow-md`, y una franja tonal para el total. El color claro aprobado para esa franja es `#F4E9DF`; se expondrá como un token semántico de superficie de total en vez de escribirse dentro del componente. La franja de fechas es solo de lectura y no contiene acción de actualizar; si el huésped necesita otro rango, vuelve al landing para iniciar una búsqueda nueva. La ruta permite quitar habitaciones y regresar de forma predecible; una selección vacía expone una recuperación hacia disponibilidad.

### 5. Acción desde detalle condicionada por fechas

El CTA de detalle deriva su estado del rango de fechas efectivo. Sin rango válido, se muestra únicamente la acción de consultar disponibilidad; con rango válido se habilita agregar, conservando las habitaciones previamente seleccionadas. Esto evita crear selecciones imposibles de cotizar o confirmar.

La acción de disponibilidad compartida por el template se conserva como único CTA sin fechas. El control contextual inferior no debe duplicarla: sin fechas no se renderiza; con fechas muestra agregar o, si ya está seleccionada, un estado explícito con la única acción de quitar.

### 6. Viaje de agregado y detalle expandible del carro

La representación del agregado parte desde el rectángulo de su botón, viaja hacia el centro geométrico del carro y reduce su escala durante el trayecto. Usa solamente transformaciones y opacidad, dura lo suficiente para comunicar la relación espacial sin bloquear controles y queda suprimida bajo `prefers-reduced-motion`.

El resumen de ítems es un control de expansión accesible y muestra un indicador visible de despliegue, por ejemplo un chevron que cambia de orientación junto al texto. Al abrirse, el detalle se integra dentro de la misma cápsula y el carro aumenta solo hacia arriba, por la altura natural necesaria para una fila por habitación. La fila original de identidad, resumen y checkout conserva su alineación vertical centrada dentro de la cápsula expandida para no verse desplazada ni desbalanceada. Cada fila incluye nombre, noches y precio por noche, más una X visualmente compacta alineada al extremo derecho para quitar esa habitación. La X es un botón con nombre accesible que incluye el nombre de la habitación y un área táctil de al menos 44 px; reutiliza la transición client-side de la selección, por lo que contador y subtotal se actualizan de inmediato. Un detector de interacción exterior y Escape cierran el detalle; el cambio de selección también lo cierra para evitar datos obsoletos. La entrada/salida usa opacidad y transformaciones, y bajo movimiento reducido muestra el estado final sin desplazamiento.

## Risks / Trade-offs

- [Parámetros URL manipulados o vencidos] → revalidar en pre-reserva y conservar validación autoritativa final.
- [Carro fijo oculta contenido o controles móviles] → incluir espaciado de reserva, área segura y pruebas responsive.
- [La composición se aleja de la referencia aprobada] → verificar explícitamente cápsula, tonos del sistema, separadores, badge y CTA en captura de escritorio y móvil.
- [Movimiento causa mareo o reduce rendimiento] → respetar movimiento reducido, animar solo transform/opacidad y no depender de fin de animación.
- [Cambios rápidos de selección] → derivar el estado de una única fuente URL y hacer cada animación cancelable.
- [Contexto persistente obsoleto] → usarlo solo como respaldo de URL, revalidar antes de continuar y limpiarlo al confirmar.
- [Entrada del carro provoca mareo o salto] → animar solamente transform/opacidad, preservar scroll y ofrecer estado final inmediato bajo movimiento reducido.
- [Detalle expandido oculta o queda obsoleto] → integrarlo en el carro, ajustar su altura al contenido, mantener centradas las zonas existentes, cerrarlo por interacción exterior/Escape/cambio de selección y conservar CTA y total visibles.
- [Acción de eliminación pequeña o ambigua] → mantener la X visualmente secundaria, pero proveer un objetivo táctil de 44 px y un nombre accesible específico por habitación.
- [La pre-reserva se aleja de la referencia] → revisar explícitamente fondo marfil, tarjetas sin borde con `shadow-md`, franja total `#F4E9DF` mediante token semántico y resumen no editable de fechas en escritorio y móvil.

## Migration Plan

1. Introducir carro y ruta de pre-reserva detrás de las mismas selecciones URL existentes.
2. Sustituir el resumen embebido después de verificar navegación y accesibilidad.
3. Ejecutar pruebas unitarias, responsive y end-to-end del nuevo flujo; el rollback restaura el resumen previo sin tocar reservas existentes.
