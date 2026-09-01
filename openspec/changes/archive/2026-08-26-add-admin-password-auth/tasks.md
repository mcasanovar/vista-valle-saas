## 1. Límites seguros de sesión

- [x] 1.1 Añadir las operaciones server-side de inicio y cierre de sesión con Supabase SSR, validación y normalización de correo, verificación remota de usuario y cookies en un contexto de mutación permitido; verificar con pruebas unitarias que credenciales, tokens y claves no aparecen en respuestas ni logs.
- [x] 1.2 Aplicar allowlist después de iniciar sesión, revocar una sesión de correo no autorizado y mantener los fallos de verificación cerrados; verificar con pruebas unitarias que una identidad no autorizada, expirada o manipulada nunca accede a `/admin`.
- [x] 1.3 Proteger las mutaciones contra origen/redirección no confiables y respetar límites de intentos disponibles del proveedor o plataforma sin inventar almacenamiento efímero; verificar con pruebas de ruta que entradas malformadas y destinos externos se rechazan con mensajes genéricos.

## 2. Experiencia de acceso administrativo

- [x] 2.1 Reemplazar el placeholder de `/admin/login` por un formulario accesible de correo y contraseña con estado de carga, validación y errores no enumerables; verificar con pruebas de componente que etiquetas, foco, mensaje y estado disabled son correctos.
- [x] 2.2 Conectar el formulario con el límite server-side y redirigir únicamente a `/admin` después de una sesión verificada y allowlisted; verificar con pruebas de integración que las credenciales válidas permitidas llegan al panel y las demás permanecen en login.
- [x] 2.3 Añadir un control accesible de cierre de sesión en el shell administrativo y limpiar la sesión antes de redirigir al acceso; verificar con pruebas que la sesión posterior no puede visitar una ruta protegida.

## 3. Verificación de seguridad e integración

- [x] 3.1 Ejecutar typecheck, lint y las pruebas de autenticación; verificar que no existen regresiones en las fronteras de autorización, adaptadores Supabase o rutas administrativas.
- [x] 3.2 Recorrer el flujo de login, acceso, logout, error de credenciales y usuario fuera de allowlist en un entorno Supabase configurado; verificar que el panel nunca se renderiza para una identidad no verificada y que no se expone información sensible.

