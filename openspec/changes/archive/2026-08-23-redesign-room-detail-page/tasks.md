## 1. Orden de secciones y encabezado

- [x] 1.1 Ajustar la plantilla de la página de detalle para que renderice las secciones en el orden: encabezado, aviso de demostración (si aplica), título/descripción, galería, características/servicios, tarjeta de precio; verificar visualmente contra `proposes/mejora-detalle-habitacion.png`
- [x] 1.2 Verificar que el aviso de contenido de demostración solo aparece cuando la habitación proviene de fixtures mock, con una prueba de componente para ambos casos (mock y producción)

## 2. Galería de imágenes

- [x] 2.1 Ajustar el organismo de galería para presentar tres fotografías de igual ancho en una sola fila en breakpoints de escritorio
- [x] 2.2 Ajustar el comportamiento responsive de la galería para apilar o deslizar las fotografías en móvil sin perder acceso a ninguna imagen; verificar en los breakpoints existentes de la suite de accesibilidad (tarea 3.8 del MVP)

## 3. Características y servicios

- [x] 3.1 Implementar los indicadores con ícono, etiqueta y valor para capacidad, camas y baño bajo el encabezado "Características"
- [x] 3.2 Implementar la lista de verificación de servicios con marca de verificación por cada servicio incluido, bajo el encabezado "Servicios"
- [x] 3.3 Añadir pruebas de componente que verifiquen que cada característica y servicio de los datos de la habitación se renderiza con su ícono/marca correspondiente

## 4. Tarjeta de precio y llamado a la acción

- [x] 4.1 Implementar la tarjeta de precio con la etiqueta "Desde", el precio base por noche, el botón de llamado a la acción hacia disponibilidad/reserva de la habitación, y el enlace de retorno al catálogo
- [x] 4.2 Verificar mediante prueba de componente que el botón de la tarjeta navega al flujo de disponibilidad/reserva con la habitación preseleccionada, reutilizando el flujo ya existente (tarea 5.1 del MVP)

## 5. Verificación final

- [x] 5.1 Ejecutar la suite de accesibilidad y breakpoints existente (tarea 3.8 del MVP) sobre la página de detalle rediseñada y confirmar que sigue pasando
- [x] 5.2 Revisar visualmente la página de detalle en mobile, tablet, notebook y escritorio contra el diseño de referencia y documentar cualquier desviación aceptada
