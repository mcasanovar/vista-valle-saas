## Why

El proyecto ya define contratos y adaptadores productivos para Supabase (Postgres, Auth y Storage) bajo el contexto `production`, pero nunca se han ejecutado contra un proyecto Supabase real: no existe forma de aplicar las migraciones de Drizzle a una base real, la suite de integración solo reproduce la migración inicial (`0000`) y no las tres migraciones posteriores, y no hay un administrador ni políticas RLS/Storage activas en ningún proyecto real. Vista Valle ya cuenta con un proyecto Supabase (`ljwukpcwysvahqmrpwjd`, región `sa-east-1`) vacío y con credenciales verificadas, por lo que corresponde activar esa infraestructura ahora.

## What Changes

- Agregar un índice sobre `reservations(check_in, check_out)` al esquema de Drizzle, dado que las consultas de disponibilidad lo necesitan y hoy no existe.
- Configurar `drizzle.config.ts` para aceptar credenciales reales de conexión y agregar un script `db:migrate` repetible que aplique todas las migraciones versionadas existentes a la base configurada.
- Aplicar todas las migraciones de Drizzle al proyecto Supabase real de Vista Valle, dejando el esquema completo (incluyendo cotizaciones de empresa, reservas multi-habitación y el nuevo índice) en la base real.
- Aplicar las políticas RLS (`supabase/rls/operational-tables.sql`) y la configuración de Storage/bucket (`supabase/storage/room-images.sql`) al proyecto real.
- Crear la cuenta de administrador real en Supabase Auth (`vistavallespa@gmail.com`) y configurar `ADMIN_ALLOWED_EMAILS` para reconocerla, manteniendo el registro público deshabilitado.
- Extender la suite de integración de PostgreSQL (`scripts/run-postgres-integration.mjs`) para reproducir todas las migraciones existentes en vez de solo la `0000`, de forma que el esquema completo quede verificado antes de confiar en él contra el proyecto real.
- Cargar el contenido real de las tres habitaciones (nombres, descripciones, capacidades, camas, baño, servicios, precios y fotografías) en la base y el bucket de Storage reales, reemplazando los fixtures de demostración para el catálogo publicado.
- Documentar las variables de entorno productivas necesarias para el despliegue en Vercel (sin configurar el despliegue en sí, que queda fuera de este cambio).

## Capabilities

### New Capabilities

- `production-infrastructure`: Comportamiento verificable de la infraestructura productiva de Supabase — aplicación repetible de migraciones, cobertura de integración sobre el esquema completo, y reconocimiento del administrador real configurado.

### Modified Capabilities

- Ninguna. Las capacidades públicas y de reservas ya definidas (dentro de `build-vista-valle-booking-mvp`, aún no sincronizadas a specs principales) no cambian su comportamiento observable; solo se activa la infraestructura productiva que ya contemplaban.

## Impact

- Código: `drizzle.config.ts`, `package.json` (nuevo script `db:migrate`), `scripts/run-postgres-integration.mjs`.
- Infraestructura: proyecto Supabase real (`ljwukpcwysvahqmrpwjd`) — esquema Postgres, políticas RLS, bucket de Storage, usuario administrador en Auth.
- Configuración: `.env.local` (ya actualizado con credenciales reales) y la lista de variables que deberán configurarse en Vercel al desplegar.
- Contenido: fixtures de demostración de habitaciones dejan de ser la fuente publicada; se reemplazan por datos reales cargados en Supabase.
- Fuera de alcance: dominio, remitente de Resend y proveedor de IA (task 10.2 del MVP los deja pendientes de gestión aparte), y el propio despliegue en Vercel.
