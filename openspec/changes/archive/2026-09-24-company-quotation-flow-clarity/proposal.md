## Why

El flujo de `/cotizacion-empresa` presenta sus secciones como una cascada condicional sin ningún indicador de progreso: el panel de habitaciones, la distribución de personas por habitación y el bloque de datos de empresa/desayunos aparecen o desaparecen según estado interno, sin explicar por qué. Las empresas externas que usan este formulario lo hacen de forma esporádica (una vez o muy pocas veces), por lo que no desarrollan un modelo mental del flujo con el uso repetido. Esto genera fricción concreta en dos puntos: (1) la distribución de personas por habitación no muestra progreso en vivo frente al total, y (2) el campo de desayunos pide una cantidad "por noche" sin aclarar que el sistema la multiplica por las noches de la estadía, lo que puede llevar a cotizaciones mal entendidas por el cliente.

## What Changes

- Reorganizar `/cotizacion-empresa` en 3 pasos reales de panel único visible (Fechas y personas → Habitaciones → Datos de empresa y desayunos), con un indicador de progreso persistente construido con los átomos/moléculas existentes (sin librerías de terceros). Un paso completado deja de mostrarse en pantalla mientras se está en un paso posterior; un control liviano permite volver a editarlo.
- Elegir una habitación pasa a ser una confirmación en dos fases: primero se elige la cantidad de personas sin contarla en el total, y luego una acción explícita "Agregar habitación" la suma al total asignado. Se puede cancelar la configuración o quitar una habitación ya agregada.
- El progreso de personas asignadas vs. total se comunica con un indicador visual (puntos/avatares), no con una oración como medio principal; se conserva un texto accesible equivalente para lectores de pantalla.
- El avance del paso de habitaciones al de datos de empresa/desayunos requiere presionar un botón "Continuar", habilitado solo cuando la asignación de personas está completa — reemplaza el auto-revelado y el mensaje de "desbloqueo" de la iteración anterior de este mismo cambio.
- Agregar microcopy persistente junto al campo de cantidad de desayunos que explique la fórmula de cálculo (cantidad por noche × noches de estadía = total).
- **No** se incorpora ninguna librería de tour/onboarding (react-joyride, driver.js, shepherd.js, intro.js) ni de wizard/stepper de terceros; la claridad se logra vía estructura real de pasos y ayuda visual, no vía un recorrido guiado separado del uso real del formulario.
- Sin cambios en la lógica de cálculo, persistencia, disponibilidad o correos ya existentes — es un cambio de presentación/experiencia sobre el flujo actual.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `company-quotation-flow`: se agregan requisitos de progreso visible y mensajes de desbloqueo explícitos sobre "Verificación de disponibilidad previa al formulario" y "Selección de habitaciones y capacidad visible"; se agrega microcopy obligatorio sobre "Selector y detalle de desayunos" para explicar la fórmula de cálculo por noche.

## Impact

- **Código afectado**: `src/presentation/organisms/company-quotation-controller.tsx`, `src/presentation/organisms/company-quotation-form.tsx`, posible nueva molécula de stepper en `src/presentation/molecules/molecules.tsx` o un nuevo archivo de organismo dedicado (`company-quotation-progress.tsx`).
- **Sin cambios de API ni de esquema de datos**: la lógica de cálculo servidor (`/api/company-quotations/*`) y el snapshot de cotización no se modifican.
- **Sin nuevas dependencias**: se reutiliza el sistema de diseño Tailwind existente, sin agregar librerías de tour/onboarding ni de UI.
- **Accesibilidad**: nuevo uso de `role="status"`/`aria-live` para el contador de personas asignadas; debe verificarse que no compite con otras regiones vivas ya existentes en el formulario.
