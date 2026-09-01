## Context

`/admin/login` es un placeholder. El adaptador de servidor ya verifica identidades con Supabase Auth y el layout protegido aplica la allowlist, pero no existe una interfaz ni acciones para crear o destruir sesiones. Ver `proposal.md` para la motivación.

## Goals / Non-Goals

**Goals:**
- Login de correo y contraseña con cookies de sesión compatibles con SSR.
- Autorización server-side por allowlist y cierre de sesión seguro.
- Estados de carga, error y foco accesibles.

**Non-Goals:**
- Registro, recuperación/cambio de contraseña, OAuth, MFA o gestión de usuarios.
- Alterar los requisitos de Supabase, credenciales o la allowlist en producción.

## Decisions

### 1. Acciones de sesión en el servidor

El formulario enviará las credenciales a una server action o route handler que usa el cliente Supabase SSR y escribe cookies en un contexto permitido. El servidor vuelve a verificar la identidad y la allowlist antes de completar la navegación.

**Alternativa descartada:** iniciar sesión solo desde el navegador. Aunque es viable para Supabase, hace más difícil garantizar cookies SSR y revocar de inmediato una identidad fuera de la allowlist.

### 2. Fail-closed sin detalles del proveedor

Errores de red, sesión inválida y credenciales incorrectas se convierten en mensajes genéricos. Una identidad autenticada pero no permitida cierra sesión antes de volver al acceso.

**Alternativa descartada:** diferenciar públicamente correos no permitidos de contraseñas incorrectas. Revelaría información sobre cuentas administrativas.

### 3. Defensa en profundidad para autenticación

Las credenciales se validan con un esquema estricto en el servidor y nunca se registran. La identidad se obtiene mediante la verificación remota del proveedor, no mediante datos decodificados del navegador. Las cookies se crean y renuevan exclusivamente a través de Supabase SSR; las claves de servicio permanecen server-only. Las mutaciones comprueban el origen y usan redirecciones de destino constantes. Se aplica limitación de intentos por identidad normalizada e IP cuando la plataforma disponga de un almacén o mecanismo de borde aprobado; sin él se aplican los límites nativos de Supabase y no se inventa un limitador no persistente.

**Alternativa descartada:** confiar en `getSession()` del navegador o en JWT no verificado para decidir acceso. No garantiza que la identidad siga siendo válida ni que pertenezca a la allowlist.

### 4. Logout como acción explícita del shell

El shell mostrará una acción con etiqueta visible o nombre accesible. El servidor invalida las cookies y Supabase Auth; si falla, el cliente se dirige al acceso sin tratar la sesión como válida.

## Risks / Trade-offs

- [Cookies no escritas desde un Server Component] → las mutaciones se realizan en action/route handler, no en el layout.
- [Sesión Supabase expirada o no verificable] → se falla cerrado, se limpia la sesión cuando sea posible y se redirige al acceso.
- [Entorno mock] → mantiene el adaptador de prueba existente; las pruebas de producción simulan el adaptador sin usar credenciales reales.

## Migration Plan

1. Configurar usuarios administradores y credenciales reales en Supabase Auth, con sus correos en `ADMIN_ALLOWED_EMAILS`.
2. Desplegar el flujo de login y probar una cuenta allowlisted y otra no allowlisted.
3. Rollback: revertir el cambio; no introduce migraciones ni datos persistentes propios.
