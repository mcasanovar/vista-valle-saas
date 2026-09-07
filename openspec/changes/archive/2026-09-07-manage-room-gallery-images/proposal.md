## Why

El sitio público ya abre un carrusel de fotos por habitación (`room-photo-gallery`), y el esquema de datos ya define `room_images` con posición ordenable, pero no existe ninguna forma de que el administrador cargue, ordene o retire esas fotos: hoy solo se pueden colocar mediante contenido de configuración o carga manual en base de datos. Sin un flujo de administración, las habitaciones seguirán mostrando una sola foto (o ninguna) en la landing.

## What Changes

- Agregar una pantalla en el panel admin para gestionar las fotos de cada habitación: subir nuevas imágenes, definir/cambiar cuál es la foto principal, reordenar el resto y eliminar una foto existente.
- Cambiar el proveedor de almacenamiento de fotos de habitación de Supabase Storage a **Cloudinary** (cuenta ya disponible), sin exponer ese cambio de proveedor a la landing ni al panel más allá de la URL pública de cada foto.
- Validar en el servidor tipo, tamaño y cantidad de imagen antes de subirla, reutilizando los límites ya definidos en `infrastructure/storage/contracts.ts`.
- Persistir el orden y la foto principal en `room_images` de forma que la landing y la página de detalle reflejen inmediatamente los cambios (mismo carrusel ya implementado, ahora con datos reales administrables).
- Registrar auditoría de quién sube o elimina una foto, siguiendo el mismo patrón de auditoría administrativa ya usado para reservas, pagos y bloqueos.

## Capabilities

### New Capabilities
- `admin-room-image-management`: pantalla y operaciones del panel admin para subir, reordenar, marcar como principal y eliminar fotos de una habitación, con validación de archivo y auditoría.

### Modified Capabilities
Ninguna: la nueva sección se agrega como un enlace más dentro de la navegación admin ya cubierta por `admin-dashboard-shell`, sin alterar su comportamiento adaptativo existente.

## Impact

- Nueva ruta de panel admin (`app/(admin-protected)/admin/habitaciones`) y sus acciones de servidor.
- Reescribe la rama de producción de `src/infrastructure/storage/server.ts` para usar el SDK `cloudinary` en vez de `@supabase/supabase-js`, manteniendo el contrato `RoomImageStorage` (`upload`, `list`, `remove`, `getPublicUrl`); agrega credenciales server-only de Cloudinary a la configuración de entorno.
- Usa la tabla `room_images` de `src/persistence/schema.ts` y un nuevo módulo de dominio en `src/features/room-images/`.
- La landing y la página de detalle de habitación no cambian de comportamiento (el carrusel ya existe); en producción empiezan a recibir datos reales desde `room_images` en vez de arreglos vacíos. El carrusel de demostración en contexto mock (`mockDemoRooms`) permanece estático, tal como hoy.
