## 1. Stepper de 3 pasos y panel único visible

- [x] 1.1 Reducir `QuotationProgress` a 3 pasos ("Fechas y personas", "Habitaciones", "Datos de empresa y desayunos") en `src/presentation/molecules/molecules.tsx`; verificar con prueba de componente que renderiza las 3 etiquetas y marca correctamente cuál está activa.
- [x] 1.2 En `company-quotation-controller.tsx`, ocultar por completo el panel de búsqueda/disponibilidad una vez `showsRoomForm` es verdadero (ya no debe quedar apilado junto al formulario de habitaciones); verificar con prueba que solo un panel es visible a la vez.
- [x] 1.3 Controlar el paso interno de `CompanyQuotationForm` (`"rooms" | "company"`) desde `company-quotation-controller.tsx` (prop `step` + callback `onAdvanceStep`) para que solo un panel se renderice a la vez; verificar con prueba que solo un panel está en el DOM según el paso.
- [x] 1.4 Reemplazar los controles de edición por paso ("Editar fechas y personas", "Editar habitaciones") por un único botón "Atrás" (ícono `ArrowLeft`) ubicado inmediatamente debajo de `QuotationProgress`, visible solo cuando el paso activo no es el primero, que retrocede al paso inmediatamente anterior conservando los datos ya ingresados; verificar con prueba que el botón no aparece en el primer paso, que retrocede correctamente desde habitaciones a búsqueda y desde datos de empresa a habitaciones, y que el indicador de progreso se actualiza en cada caso.

## 2. Confirmación de habitación en dos fases

- [x] 2.1 Reemplazar la selección instantánea por un estado de "configuración": elegir una habitación muestra el selector de personas (`pendingRoomSlug`/`pendingGuestCount`) sin sumarla al total; agregar botón "Agregar habitación" que confirma y mueve la cantidad a `addedRooms`, y un botón "Cancelar" que descarta la configuración sin efecto; verificar con pruebas ambos caminos.
- [x] 2.2 Adaptar el precio mostrado por ocupación (`resolveDisplayRoomNightlyPrice`) para reflejar la cantidad en configuración o ya agregada, según corresponda; verificar con prueba que el precio se actualiza en ambos estados.
- [x] 2.3 "Quitar" una habitación ya agregada debe restar su cantidad del total y devolverla a estado disponible para elegir; verificar con prueba existente adaptada.

## 3. Progreso visual de personas asignadas

- [x] 3.1 Agregar molécula `GuestAllocationMeter` (puntos/avatares llenos según personas agregadas vs. total) en `src/presentation/molecules/molecules.tsx`, con `role="status" aria-atomic="true"` y `aria-label` con el texto accesible equivalente (ej. "4 de 6 personas asignadas"); verificar con prueba de componente el conteo de puntos llenos y el `aria-label`.
- [x] 3.2 Reemplazar el bloque de texto "Huéspedes asignados: X de Y" por `GuestAllocationMeter` en `company-quotation-form.tsx`, manteniendo separado el `role="alert"` de `quotation-rooms-error` (solo en intento de envío inválido); verificar con prueba que ambas regiones no quedan anidadas.

## 4. Avance explícito con botón Continuar

- [x] 4.1 Agregar botón "Continuar" al final del paso de habitaciones, deshabilitado mientras `allocation.isComplete` sea falso, que llama a `onAdvanceStep` (el controller avanza el paso a `"company"`) al activarse; eliminar el bloque `Feedback` de "mensaje de desbloqueo" de la iteración anterior (ya no aplica); verificar con prueba que permanece deshabilitado con asignación incompleta y habilita/avanza al completarla.

## 5. Microcopy del cálculo de desayunos

- [x] 5.1 Mantener el `Text`/hint persistente junto a `quotation-breakfast-quantity` con la fórmula "cantidad por noche × noches de la estadía = total de desayunos" (ya implementado); confirmar que sigue visible solo dentro del paso de empresa cuando `breakfastRequested` es `true`.

## 6. Verificación de conjunto

- [x] 6.1 Reescribir las pruebas de `company-quotation-form.test.tsx` y `company-quotation-controller.test.tsx` afectadas por el nuevo flujo de dos fases, panel único y botón único "Atrás", y ejecutar la suite completa de cotización de empresa (`npm run test:unit` o `node scripts/with-test-env.mjs npx vitest run`) confirmando que sigue sin cambios de comportamiento en el cálculo o envío al servidor.
- [x] 6.2 Probar manualmente el flujo completo en `/cotizacion-empresa`: fechas → disponibilidad → (paso 1 desaparece) → elegir habitación → configurar personas → Agregar → progreso visual con puntos → Continuar (deshabilitado hasta completar) → paso de empresa con desayunos y microcopy → envío exitoso; confirmar que el stepper de 3 pasos refleja cada transición y que el botón "Atrás" permite volver un paso a la vez sin perder datos, ausente en el primer paso.
