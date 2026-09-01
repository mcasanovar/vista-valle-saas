## 1. Tema visual aislado

- [x] 1.1 Cargar las fuentes Manrope y Source Sans 3 con `next/font/google` en el layout admin (`app/(admin-protected)/admin/layout.tsx` o un layout de grupo dedicado) y verificar que exponen variables CSS sin afectar el layout raíz del sitio público.
- [x] 1.2 Añadir en `app/globals.css` un bloque `[data-theme="admin"]` que redefina `--color-primary`, `--color-background`, `--color-foreground`, `--color-card`, `--color-border`, `--color-muted`, `--font-heading`, `--font-sans` y los tokens nuevos (sidebar, acento, estados de reserva) con los valores literales de `design/admin-dashboards/Main.dc.html`, y verificar que el sitio público conserva sus valores actuales sin cambios visuales.
- [x] 1.3 Envolver el contenido de `AdminShell` en un elemento con `data-theme="admin"` y verificar visualmente que Calendario, Reservas, Bloqueos, Sincronizaciones, Alertas y Asistente heredan la paleta y tipografía nuevas sin tocar su JSX. (Ya implementado en `admin-shell.tsx`/`layout.tsx`; verificado por código que ninguna pantalla admin usa clases del sitio público, y con test `admin-shell-navigation.test.tsx` que confirma el scope `data-theme="admin"`.)

## 2. Shell de navegación responsivo

- [x] 2.1 Reescribir `src/features/admin/admin-shell.tsx` para renderizar el sidebar fijo de escritorio (agrupado en "OPERACIÓN"/"SISTEMA", ítem activo resaltado) según `design/admin-dashboards/Main.dc.html`, y verificar que la sección activa se resalta según la ruta actual.
- [x] 2.2 Añadir la variante de riel de solo iconos para tablet (`tablet:` hasta `laptop:`) y verificar en un viewport de 834px que el riel muestra los iconos de todas las secciones existentes con la sección activa resaltada. (Ya implementado; verificado contra `design/admin-dashboards/Tablet.dc.html` (8 íconos) y con test.)
- [x] 2.3 Añadir la variante de barra de navegación inferior fija para móvil con accesos a Resumen, Calendario, Reservas, Alertas y "Más", y verificar en un viewport de 390px que la barra permanece fija y no tapa contenido al hacer scroll. (Corregido un bug real: `mobileItems` incluía "Nueva reserva" en vez de limitarse a Resumen/Calendario/Reservas/Alertas como especifica `design/admin-dashboards/Mobile.dc.html`; cubierto con test.)
- [x] 2.4 Quitar del componente cualquier entrada de navegación a "Clientes" o "Pagos" (fuera de alcance de este change) y verificar que el nav solo lista las secciones ya existentes en el sistema.

## 3. Agregado de datos de la pantalla Resumen

- [x] 3.1 Ampliar el contrato mock de `AdminReservation` con `createdAt`, `totalClp` y `paymentStatus`, y reescribir `src/features/admin/dashboard.ts` para calcular, en contexto `"mock"`, ocupación (%), reservas activas, pagos pendientes ($) y alertas abiertas a partir de `getAdminReservationSource().list()` (y `operational-alerts.ts` para alertas), documentando con un comentario la aproximación de ocupación mientras no exista inventario real; verificar con una prueba unitaria que cada KPI refleja el estado del mock.
- [x] 3.2 Exponer en el mismo módulo una función que devuelva las N reservas más recientes con huésped, habitación, entrada, salida, estado y monto, ordenadas por `createdAt` descendente, y verificar con una prueba unitaria que ordena por fecha y respeta el límite N.
- [x] 3.3 Mantener el comportamiento de `null` en contexto `"production"` y verificar que la pantalla sigue mostrando el mensaje de "resumen operativo no disponible" en ese caso.

## 4. Pantalla Resumen (UI)

- [x] 4.1 Reescribir `app/(admin-protected)/admin/page.tsx` como server component que obtiene los datos iniciales del agregado nuevo y los pasa a un client component de vista.
- [x] 4.2 Crear el client component de la vista Resumen con las cuatro tarjetas KPI y la tabla/lista de reservas recientes, replicando la composición de `design/admin-dashboards/Main.dc.html` (desktop), `Tablet.dc.html` y `Mobile.dc.html`, y verificar en los tres breakpoints (390px, 834px, 1440px) que coincide con las capturas de referencia.
- [x] 4.3 Implementar el botón "Actualizar datos" con estado de carga (ícono reemplazado por spinner, deshabilitado, etiqueta conservada o cambiada a "Actualizando…") conectado a un re-fetch de los datos, y verificar manualmente que el texto nunca desaparece durante la carga.
- [x] 4.4 Implementar los skeletons con shimmer para tarjetas KPI y filas de la tabla durante la carga inicial y la actualización manual, y verificar que se muestran en vez de valores en cero o contenido parcial.
- [x] 4.5 Implementar el estado "sin reservas recientes" y el estado "resumen operativo no disponible" como mensajes explícitos, y verificar ambos casos manualmente forzando el contexto correspondiente.

## 5. Verificación final

- [x] 5.1 Ejecutar la suite de pruebas existente (`npm test` o equivalente) y verificar que no hay regresiones en `src/features/admin`. (91/95 archivos pasan; los 3 fallos restantes son preexistentes y no relacionados — sitio público: `home-page`, `prebooking-review-controller`, `room-detail`. Cero fallos en `src/features/admin`.)
- [x] 5.2 Recorrer manualmente el panel admin completo (Resumen, Calendario, Reservas, Bloqueos, Sincronizaciones, Alertas, Asistente) en los tres breakpoints y verificar consistencia visual del tema nuevo en todas las pantallas. (Verificado por el usuario.)
- [x] 5.3 Recorrer manualmente el sitio público de reservas y verificar que su paleta, tipografía y componentes no cambiaron. (Verificado por el usuario.)
