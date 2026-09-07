## 1. Storage: Cloudinary en producción, mock persistente

- [x] 1.1 Agregar la dependencia `cloudinary` y las variables server-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` a `src/config/server.ts` (requeridas en producción) y a `.env.example`/`.env.test.example` con valores mock; verificar que `npm run build` con contexto mock no exige credenciales reales
- [x] 1.2 Reescribir la rama de producción de `src/infrastructure/storage/server.ts` para usar el SDK `cloudinary` (`upload`, `list` vía `api.resources` con `prefix`, `remove` vía `uploader.destroy`, `getPublicUrl` vía `cloudinary.url`) manteniendo el contrato `RoomImageStorage` sin cambios; verificado con pruebas unitarias que cada método delega en la llamada esperada del SDK (mockeado, vía `createCloudinaryRoomImageStorage` extraído para no depender de `getServerEnvironment()`)
- [x] 1.3 Relajar `assertRoomImageRoomId`/`assertRoomImagePath` en `src/infrastructure/storage/contracts.ts` de UUID estricto a slug seguro (alfanumérico, `-`/`_`); verificado con una prueba que el mock acepta ids de habitación de demostración (`demo-room-valle`). El aislamiento por instancia del storage mock se mantiene sin cambios (nada llama `storage.list()` fuera de sus propias pruebas; la metadata de orden vive en el store de dominio de `room-images`, no en el storage)

## 2. Dominio y persistencia de `room_images`

- [x] 2.1 Crear `src/features/room-images/` con funciones de dominio para listar, subir (lote todo-o-nada), reordenar, marcar como principal y eliminar fotos de una habitación, con límite dual mock (store en memoria) / producción (`room_images` vía Drizzle), siguiendo el patrón de `src/features/room-blocks/manual-blocks.ts`; verificar con pruebas unitarias en mock que la posición 0 siempre corresponde a la foto principal y que no se duplican posiciones
- [x] 2.2 Crear `src/infrastructure/database/room-image-repository.ts` con la reescritura atómica de posiciones (reordenar y promoción tras eliminar la principal) dentro de una transacción Drizzle; verificar con la prueba de integración Postgres opt-in (`tests/postgres-room-images.integration.test.ts`, mismo patrón que `postgres-room-block.integration.test.ts`) que elimina la principal habiendo otras fotos y confirma que la siguiente pasa a posición 0
- [x] 2.3 Implementar limpieza del objeto de storage recién subido si la escritura en `room_images` falla; verificar con una prueba que simula el fallo de escritura y comprueba que no queda el archivo huérfano en el adaptador mock
- [x] 2.4 Registrar un evento en `audit_events` (producción) o su equivalente en memoria (mock) por cada operación (carga, principal, orden, eliminación) con actor y fecha; verificar con una prueba que cada operación crea el evento esperado

## 3. Server actions

- [x] 3.1 Crear `src/features/room-images/actions.ts` con server actions autenticadas para listar, subir, reordenar, marcar principal y eliminar, reutilizando `requireAdministrator()`; verificar con una prueba que una solicitud no autenticada es rechazada
- [x] 3.2 Validar en cada acción los límites de `assertRoomImageUpload` (tipo, tamaño) antes de tocar storage o base de datos; verificar con una prueba que un archivo inválido no genera ninguna escritura

## 4. Interfaz de administración

- [x] 4.1 Crear la ruta `app/(admin-protected)/admin/habitaciones/page.tsx` que liste las habitaciones activas desde `getRoomReadSource()` (mismo selector que ya usa `admin/bloqueos`) con un enlace a la gestión de fotos de cada una; verificado en vivo contra producción real (Chrome + servidor `next dev` en contexto production del propio usuario): lista las 3 habitaciones reales con su conteo de fotos correcto
- [x] 4.2 Crear la ruta `app/(admin-protected)/admin/habitaciones/[roomId]/fotos/page.tsx` que liste las fotos de la habitación en su orden vigente, señalando la principal; verificado en vivo: la foto migrada desde Supabase Storage aparece marcada "Principal"
- [x] 4.3 Agregar el control de carga de una o más imágenes con retroalimentación de progreso y de error por archivo inválido; verificado en vivo subiendo dos imágenes reales contra Cloudinary de producción. Durante esta verificación se encontró y corrigió un bug real: `uploadRoomImagesAction` devolvía solo las fotos recién subidas en vez de la lista completa, haciendo que la foto principal existente desapareciera de la UI hasta recargar (los datos en BD/Cloudinary siempre fueron correctos). Corregido para que la acción siempre devuelva `listRoomImages(roomId)` completo
- [x] 4.4 Agregar controles para reordenar fotos secundarias y para marcar una foto como principal, con confirmación visual del nuevo estado; verificado en vivo: "Hacer principal" y las flechas de orden actualizan la UI y persisten correctamente
- [x] 4.5 Agregar confirmación explícita y control de eliminación de una foto; verificado en vivo: eliminar la foto principal promueve la siguiente sin recargar la página
- [x] 4.6 Agregar el enlace a "Habitaciones" desde la navegación admin existente (`src/features/admin/admin-shell.tsx`, sidebar/riel/barra inferior) sin alterar su comportamiento adaptativo; verificado en vivo en la variante de escritorio, visible bajo "SISTEMA"

## 5. Integración con el sitio público (límite de producción)

- [x] 5.1 Verificado tanto por la prueba de integración Postgres opt-in (`tests/postgres-room-images.integration.test.ts`) como en vivo contra la base de datos real: `queryProductionRooms()` y `createRoomReadSource` reflejan los cambios de `room_images` sin modificaciones adicionales a esos archivos. Además se detectó y migró un caso real: las 3 fotos de habitaciones ya existentes en producción estaban en Supabase Storage; se migraron a Cloudinary con `scripts/migrate-room-images-to-cloudinary.mjs` preservando el mismo `storage_path`
- [x] 5.2 Documentado en `design.md` (Goals/Non-Goals y Decisions): el carrusel de demostración en contexto mock (`mockDemoRooms`) no se alimenta de este store administrado; el requisito de reflejo inmediato se verifica en el límite de producción

## 6. Documentación y cierre

- [x] 6.1 `.env.example`/`.env.test.example`/`.env.local` actualizados con las variables de Cloudinary; eliminado `supabase/storage/room-images.sql` (bucket ya no usado) y reescrito `src/infrastructure/storage/README.md` para describir Cloudinary en vez de Supabase Storage
- [x] 6.2 `tsc --noEmit`, `eslint .` y `npm run test:unit` ejecutados: 0 errores de tipos, 0 de lint. 505/507 tests pasan; se detectaron y corrigieron 4 fallas causadas por este cambio (`infrastructure-boundaries.test.ts` x2 y `home-page.test.tsx` por las nuevas variables `CLOUDINARY_*` requeridas; `admin-shell-navigation.test.tsx` por el índice de `mobileItems` desplazado al insertar "Habitaciones" en el grupo SISTEMA, corregido a una búsqueda por `href`). Las 2 fallas restantes (`prebooking-review-controller.test.tsx`, `room-detail.test.tsx`) provienen de una edición en paralelo ajena a este cambio (clases CSS de `room-card.tsx` y otros organisms/templates públicos ya modificados en el árbol de trabajo antes de esta sesión) y no se tocan aquí
