## Context

`src/persistence/schema.ts` ya define `room_images` (`roomId`, `storagePath`, `altText`, `position` con índice único `(roomId, position)`). `src/infrastructure/storage/{contracts,server,mock}.ts` ya define el contrato `RoomImageStorage` (`upload`, `list`, `remove`, `getPublicUrl`) con validación de tipo/tamaño (`assertRoomImageUpload`); su implementación de producción usaba Supabase Storage. `src/infrastructure/database/room-source.ts` ya lee `room_images` ordenadas por `position` para alimentar `src/features/rooms/read-model.ts`, que a su vez alimenta el carrusel público ya implementado (`room-photo-gallery.tsx`, `room-photo-lightbox.tsx`), pero solo bajo el límite `production` de `createDatabaseBoundary()`. Falta la capa de administración: ninguna ruta admin ni acción de servidor escribe en `room_images` ni en el storage, y no existe ningún listado admin de habitaciones desde el cual llegar a ella. Ver `proposal.md` para la motivación.

Decisión del propietario del producto: el proveedor de almacenamiento de imágenes de habitación pasa de Supabase Storage a **Cloudinary** (cuenta ya disponible), reemplazando la implementación de producción de `RoomImageStorage` sin cambiar su contrato.

## Goals / Non-Goals

**Goals:**
- Definir cómo el panel admin sube, reordena, marca como principal y elimina fotos de una habitación usando la infraestructura de storage y la tabla `room_images` ya existentes.
- Mantener la "foto principal" y el "orden" como conceptos consistentes con lo que ya consume `read-model.ts` (posición 0 = principal).
- Auditar cada operación reutilizando `audit_events`.

**Non-Goals:**
- No se rediseña el carrusel público ni sus componentes (`room-photo-gallery.tsx`, `room-photo-lightbox.tsx`, `room-gallery.tsx`); ya cumplen el spec `room-photo-gallery`.
- No se agrega edición de texto alternativo por foto más allá de un campo opcional simple; no hay generación automática de alt-text.
- No se cubre la migración masiva de fotos de producción (tarea 10.1 del cambio `build-vista-valle-booking-mvp`, ya fuera de alcance de este cambio).
- No se construye un CRUD completo de habitaciones (nombre, precio, capacidad, etc.); el listado admin nuevo solo sirve como punto de entrada a la gestión de fotos, reutilizando `getRoomReadSource()` ya existente.
- El carrusel de demostración (`mockDemoRooms`, `isDemonstration: true`) no se conecta al nuevo store de fotos administradas: sigue siendo un arreglo estático, tal como lo describe `build-vista-valle-booking-mvp` ("excluido del contexto production"). El requisito de "reflejo inmediato" se cumple en el límite de producción, donde `room-source.ts` ya construye `images` desde `room_images`.

## Decisions

- **Proveedor de storage: Cloudinary en producción, adaptador en memoria en mock**: se reemplaza la implementación de producción de `src/infrastructure/storage/server.ts` (Supabase Storage) por el SDK `cloudinary`, manteniendo el contrato `RoomImageStorage` sin cambios. `getPublicUrl` usa `cloudinary.url(path, { secure: true })`; `upload` usa `cloudinary.uploader.upload` con `public_id: path` y `overwrite: true`; `remove` usa `cloudinary.uploader.destroy(path)`; `list` usa `cloudinary.api.resources({ type: "upload", prefix: "rooms/<roomId>/" })`. La construcción del cliente Cloudinary se aísla en `createCloudinaryRoomImageStorage(credentials)`, separada del `createRoomImageStorage()` que lee `getServerEnvironment()`, para poder probar la rama de producción sin alternar `VISTA_VALLE_CONFIG_CONTEXT` en el proceso de test. El adaptador mock sigue siendo un almacén en memoria sin red, aislado por instancia tal como ya lo probaba `tests/storage.test.ts`: nada fuera de sus propias pruebas llama `storage.list()`, así que esa persistencia no la necesita el storage — la necesita el store de dominio de `room-images` (ver decisión de límite dual mock/producción más abajo).
- **Identificador de habitación desacoplado de UUID de Postgres en la capa de storage**: `assertRoomImageRoomId`/`assertRoomImagePath` exigían un UUID v4 estricto, heredado de que `room_images.roomId` es `uuid` en Postgres. Se relaja a un slug seguro (alfanumérico, `-`/`_`) para que el mismo adaptador de storage sirva tanto a habitaciones reales (UUID) en producción como a las habitaciones de demostración (`demo-room-valle`, etc.) que ya devuelve `getRoomReadSource()` en mock — el mismo selector de habitación que ya usa `admin/bloqueos`. La restricción de que `room_images.roomId` sea un UUID válido la sigue imponiendo Postgres/Drizzle en producción; el storage ya no necesita reimponerla.
- **Selector de habitaciones reutiliza `getRoomReadSource()`**: el nuevo listado `/admin/habitaciones` reutiliza `getRoomReadSource().listActive()` (ya usado por `admin/bloqueos`) en vez de construir un repositorio de habitaciones nuevo; evita duplicar la fuente de verdad de qué habitaciones existen.
- **Posición 0 = foto principal**: en lugar de una columna booleana `isMain`, la foto en `position = 0` es la principal. Reutiliza el índice único `(roomId, position)` ya existente y evita una migración de esquema. Alternativa considerada: columna `isMain` separada — se descarta porque duplicaría la noción de "primero" que `read-model.ts` ya usa vía orden de `position`.
- **Reordenamiento por reescritura atómica de posiciones**: cambiar el orden (incluida la promoción a principal) se implementa reasignando `position` a todas las fotos de la habitación en una única transacción, nunca por swaps parciales, para no violar el índice único ni dejar huecos.
- **Carga en lote todo-o-nada**: si cualquier archivo del lote falla la validación de `assertRoomImageUpload`, no se sube ni persiste ninguno del lote, evitando estados parciales confusos para el administrador.
- **Dominio con límite dual mock/producción en `src/features/room-images/`**: sigue el patrón ya usado en `src/features/room-blocks/` (store en memoria bajo `Symbol.for(globalThis)` en mock; repositorio Drizzle + transacción en producción) y expone `src/features/room-images/actions.ts` como server actions, en vez de una API REST separada.
- **Eliminación de la principal promueve la siguiente**: al eliminar `position = 0`, la foto en `position = 1` (si existe) se reescribe a `position = 0` dentro de la misma transacción, cumpliendo el requisito de la spec sin dejar a la habitación con "principal ausente" mientras haya otras fotos.

## Risks / Trade-offs

- [Subidas concurrentes de dos administradores a la misma habitación pueden pisar el reordenamiento] → La reescritura de posiciones ocurre dentro de una transacción de base de datos con lectura del estado vigente inmediatamente antes de escribir; el segundo escritor sobreescribe con su propio orden completo, lo cual es aceptable dado que solo hay un administrador operando el panel en la práctica.
- [Archivos huérfanos en Cloudinary si la escritura en `room_images` falla después de subir el archivo] → Subir primero a Cloudinary y solo después escribir la fila en `room_images` dentro de la misma operación de servidor; si la escritura en base de datos falla, se intenta destruir el recurso recién subido antes de reportar el error.
- [Nueva dependencia externa (Cloudinary) con sus propios límites de cuota/latencia] → Se aísla detrás del contrato `RoomImageStorage` ya existente; cambiar de proveedor de nuevo no requiere tocar el dominio ni la UI, solo `infrastructure/storage/server.ts`.

## Migration Plan

Sin migración de esquema: la tabla `room_images` ya existe. Se agregan variables de entorno server-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (requeridas en producción, con valores mock en `.env.test.example`/`.env.example`), la dependencia `cloudinary`, la ruta admin, las server actions y sus pruebas; no requiere backfill de datos ni credenciales de Supabase Storage.
