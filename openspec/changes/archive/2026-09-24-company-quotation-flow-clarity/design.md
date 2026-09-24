## Context

Ver `proposal.md` - Why. El flujo vive hoy como una cascada de renderizado condicional dentro de dos componentes: `src/presentation/organisms/company-quotation-controller.tsx` (fechas/personas → disponibilidad) y `src/presentation/organisms/company-quotation-form.tsx` (habitaciones → distribución de personas → datos de empresa/desayunos). No existe router de pasos, tabs ni wizard: cada sección se monta u oculta según estado local (`values`, `guestCounts`, `availability`, `selectedRooms`). El sistema de diseño es Tailwind 4 puro con átomos propios (`src/presentation/atoms/atoms.tsx`) y moléculas (`src/presentation/molecules/molecules.tsx`); no hay Radix ni shadcn. No existe hoy ninguna librería de tour/onboarding en el proyecto, y la decisión de producto (ver proposal) es no introducir una.

Investigación de UX que fundamenta este diseño:
- Patrón validado: "Multi-step progress" requiere step indicator o progress bar visible (ux-guidelines: Feedback/Progress Indicators).
- Contadores en vivo deben anunciarse como frase contextual completa vía `role="status"`/`aria-atomic`, nunca como número suelto (ux-guidelines: Accessibility/Contextual Live Badge Updates).
- Ayuda contextual en el punto de uso ("Context over Ceremony") es preferible a un modo de tutorial separado para usuarios esporádicos que no repiten el flujo (Impeccable `onboard.md`).
- Este formulario opera en modo "Operate" (Impeccable `layout.md`): estructura predecible y densidad estable priman sobre composición expresiva.

## Goals / Non-Goals

**Goals:**
- Hacer visible en todo momento en qué sección del flujo está el visitante y cuántas faltan, usando solo los átomos/moléculas ya existentes.
- Reemplazar cada ocultamiento silencioso de sección por un mensaje explícito de qué falta para desbloquearla.
- Anunciar accesiblemente el progreso de personas asignadas por habitación como frase contextual, no como número aislado.
- Explicar en el punto de uso que "desayunos por noche" se multiplica por las noches de la estadía.

**Non-Goals:**
- No se introduce un wizard con rutas/URLs por paso; el flujo sigue siendo una sola página (`/cotizacion-empresa`).
- No se modifica ningún cálculo de precio, disponibilidad, persistencia ni contenido de correos.
- No se agrega ninguna librería de tour, onboarding o tooltip de terceros.
- No se rediseña la identidad visual del sitio (paleta, tipografía); este cambio es de estructura/claridad dentro del sistema visual vigente.

## Decisions

> **Revisión (post-implementación inicial):** la primera vuelta de este diseño superponía un stepper visual sobre el mismo layout de cascada (todas las secciones seguían apiladas en una sola pantalla). El usuario probó esa versión y pidió un rediseño real: paneles de un solo paso visible a la vez, confirmación explícita de habitación en dos fases, progreso visual (no textual) y un botón "Continuar" que gatille el avance. Las decisiones 1-4 originales quedan reemplazadas por las decisiones 1-6 siguientes.

### 1. El stepper es una molécula nueva y ahora tiene 3 pasos, no 4
`QuotationProgress` en `src/presentation/molecules/molecules.tsx` pasa de 4 a 3 pasos: "Fechas y personas", "Habitaciones", "Datos de empresa y desayunos". La verificación de disponibilidad deja de ser un paso propio: sus resultados (éxito, parcial, insuficiente, nulo) se muestran dentro del paso 1, y solo se avanza al paso 2 cuando hay disponibilidad suficiente. Sigue sin usar ninguna librería externa (ver razón original: no hay Radix/shadcn en el proyecto).

### 2. Panel único visible por paso (no cascada apilada)
`CompanyQuotationController` deja de renderizar el formulario de búsqueda y el resultado de disponibilidad al mismo tiempo que el formulario de habitaciones: una vez `showsRoomForm` es verdadero y el visitante no está viendo la búsqueda (`viewingSearch === false`), el paso 1 se oculta por completo y se muestra solo `CompanyQuotationForm`. El paso interno del formulario (`"rooms" | "company"`) es controlado por el controller (prop `step` + callback `onAdvanceStep`) en vez de vivir como estado propio del formulario, de modo que un único punto (el controller) decide qué panel se muestra y puede implementar el retroceso.
**Alternativa descartada**: mantener todo apilado y solo mejorar el indicador (lo ya implementado en la primera vuelta). Descartada explícitamente por el usuario: no resuelve la sobrecarga de información en una sola pantalla.
**Revisión posterior**: la primera versión de esta decisión ofrecía un control de "editar" por paso ("Editar fechas y personas", "Editar habitaciones"). El usuario pidió reemplazarlos por un único botón "Atrás" debajo del stepper (ver decisión 7); por eso el paso pasó a ser controlado desde el controller en vez de interno al formulario — así un solo botón puede decidir a qué paso retroceder sin que el formulario necesite exponer un botón de edición propio.

### 3. Selección de habitación en dos fases: configurar → agregar
Elegir una habitación ya no la cuenta de inmediato. Se introduce un estado `pendingRoomSlug` (habitación "en configuración", con su cantidad elegida en un estado temporal `pendingGuestCount`) separado de `addedRooms` (habitaciones ya confirmadas, que sí alimentan `selections`/`allocation`/el total enviado al servidor). El botón "Agregar habitación" mueve la configuración pendiente a `addedRooms`; "Cancelar" la descarta sin efecto; "Quitar" remueve una habitación ya agregada. Esto hace explícitas, como dos acciones separadas, "elegir personas" y "agregar la habitación", en vez de que la selección misma ya cuente con un valor por defecto oculto.
**Alternativa descartada**: mantener la selección instantánea y solo agregar un tooltip explicando la mecánica. Descartada porque el usuario pidió específicamente ayuda visual en vez de más texto.

### 4. Progreso visual de puntos/avatares en vez de una oración
El resumen "Huéspedes asignados: X de Y" deja de ser el medio primario de comunicar el progreso. Se agrega una nueva molécula `GuestAllocationMeter` que renderiza un punto/avatar por persona del total, lleno u vacío según `addedRooms`, dentro de un contenedor `role="status" aria-atomic="true"` cuyo `aria-label` lleva el texto equivalente accesible (la misma frase de `describeGuestAllocation`, ahora oída por lectores de pantalla pero no mostrada como bloque de texto visible). El mensaje de error `role="alert"` de `quotation-rooms-error` solo aparece al intentar enviar con distribución incompleta (submit-time), preservando la separación de regiones vivas ya decidida en la iteración anterior.

### 5. Avance explícito con botón "Continuar", sin auto-revelado
El paso de "Datos de empresa y desayunos" deja de aparecer automáticamente al agregar la primera habitación. En su lugar, el paso "Habitaciones" muestra un botón "Continuar" (usa el átomo `Button` existente), deshabilitado mientras `allocation.isComplete` sea falso, que al activarse cambia el estado interno del formulario a `"company"`. Esto reemplaza por completo el bloque `Feedback` de "mensaje de desbloqueo" de la iteración anterior — ya no hace falta explicar por qué no se ve el panel de empresa, porque el panel de habitaciones sigue siendo el único visible hasta que el visitante decide avanzar.

### 6. El stepper del controller deriva su paso activo del estado que ya controla
`activeStepIndex` se calcula como 0 mientras se muestre el panel de búsqueda (`showsSearchPanel`, que incluye tanto "todavía sin disponibilidad suficiente" como "el visitante volvió a este paso con Atrás"), 1 mientras `formStep === "rooms"`, y 2 cuando `formStep === "company"`. Como `formStep` y `viewingSearch` ahora viven en el controller (ver decisión 2), este cálculo no depende de ninguna notificación externa.

### 7. Un único botón "Atrás" debajo del stepper, sin controles de "editar" por paso
Se agrega un solo botón "Atrás" (ícono `ArrowLeft` + texto), ubicado inmediatamente debajo de `QuotationProgress` y visible solo cuando `activeStepIndex > 0`. Su acción es puramente posicional: si el formulario está en `"company"`, retrocede a `"rooms"`; si está en `"rooms"`, vuelve a mostrar el panel de búsqueda (`setViewingSearch(true)`). Esto reemplaza los botones "Editar fechas y personas" y "Editar habitaciones" de la iteración anterior — el usuario pidió explícitamente un único punto de retroceso en vez de un control de edición por sección.
**Alternativa descartada**: mantener botones de "editar" específicos por sección (el diseño anterior). Descartada por el usuario: quería una única affordance de navegación hacia atrás, consistente con el patrón de un wizard convencional.

## Risks / Trade-offs

- [Riesgo: dos fuentes de verdad para "cantidad de una habitación" — `pendingGuestCount` mientras se configura y `addedRooms` una vez confirmada] → Mitigación: `selections`/`allocation` se derivan exclusivamente de `addedRooms`; `pendingGuestCount` nunca se lee fuera del panel de configuración de esa habitación.
- [Riesgo: ocultar el paso anterior sin ruta/URL propia puede sentirse como "perder" el trabajo ya hecho] → Mitigación: los controles "Editar fechas y personas" / "Editar habitaciones" preservan el estado ya ingresado (no se resetea `values`/`addedRooms` al volver), y solo limpian estado cuando el usuario cambia realmente la búsqueda (fechas/personas).
- [Riesgo: el medidor de puntos no comunica capacidad restante por habitación tan explícitamente como el texto anterior] → Mitigación: el texto accesible completo sigue existiendo (solo se oculta visualmente, no se elimina), y el estado deshabilitado de "Continuar" ya comunica visualmente que falta completar la asignación.
- [Riesgo: con muchas personas (ej. 20), un punto por persona puede volverse denso visualmente] → Mitigación: fuera de alcance por ahora — el catálogo de habitaciones de Vista Valle es pequeño (3 tipos, capacidad total baja); se puede revisar un tope de agrupación si el catálogo crece.

## Open Questions

- Copy exacto de cada etiqueta del stepper y de los controles "Editar..." — se puede definir durante implementación sin afectar los requisitos ya especificados.
