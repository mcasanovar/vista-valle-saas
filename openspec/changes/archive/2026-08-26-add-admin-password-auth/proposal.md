## Why

El panel administrativo redirige correctamente ante una sesión no verificable, pero `/admin/login` es solo un placeholder. Se necesita un flujo real de correo y contraseña para que los administradores autorizados puedan iniciar y cerrar sesión sin exponer contenido protegido.

## What Changes

- Se añade inicio de sesión administrativo con correo y contraseña mediante Supabase Auth.
- Se valida en servidor que el usuario autenticado pertenece a `ADMIN_ALLOWED_EMAILS` antes de permitir acceso al panel.
- Se implementa cierre de sesión y redirección segura entre login y panel.
- Se muestran errores de autenticación claros sin revelar secretos ni detalles del proveedor.
- No se habilita registro público ni recuperación de contraseña en este cambio.

## Capabilities

### New Capabilities

- `admin-password-auth`: autenticación administrativa con correo y contraseña, control de acceso por allowlist y cierre de sesión.

### Modified Capabilities

(ninguna)

## Impact

- `app/admin/login/page.tsx` y componentes de formulario de autenticación.
- Adaptadores Supabase de navegador/servidor y rutas o acciones de sesión.
- `app/(admin-protected)/admin/layout.tsx` y el shell admin para proteger y cerrar sesión.
- Pruebas unitarias y end-to-end de autenticación administrativa.
