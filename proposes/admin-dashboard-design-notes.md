# Referencia visual — Panel de administración (Opción 1: Slate profesional)

Material de apoyo para el change de OpenSpec que defina la spec visual del panel admin
(`app/(admin-protected)/admin`). No modifica ninguna spec existente; es solo la referencia
de diseño, igual que `mejora-detalle-habitacion.png` lo fue para `room-detail-page`.

## Dónde está todo

- **Capturas de referencia** (usar como imagen de referencia en `proposal.md`/`design.md`):
  - `proposes/propuesta-admin-dashboard-desktop.png`
  - `proposes/propuesta-admin-dashboard-tablet.png`
  - `proposes/propuesta-admin-dashboard-mobile.png`
- **Canvas interactivo** (Claude Design, con estados de carga activables):
  https://claude.ai/code/artifact/b445d4da-f869-4877-84ef-e7c9415a38cb
- **Fuente exacta (HTML/CSS, valores reales — no aproximar desde el PNG)**:
  `design/admin-dashboards/Main.dc.html` (desktop), `Tablet.dc.html`, `Mobile.dc.html`.
  Cada archivo es HTML+CSS inline autocontenido; los valores de color, tipografía,
  radios y espaciado están literales en los atributos `style`.

## Alcance y no-alcance

- El panel admin es una plataforma de gestión interna (habitaciones, reservas,
  clientes, pagos), separada en flujo del sitio público de reservas. **No** reutiliza
  la paleta ni los componentes del sitio de reservas; es intencional.
- Esta referencia cubre únicamente la pantalla "Resumen" (`/admin`). El mismo lenguaje
  visual (sidebar, tarjetas, tabla/lista, skeletons, botón con carga) se extiende al
  resto de secciones cuando se especifiquen.
- No se definió aún el detalle de Calendario, Reservas, Clientes, Pagos, Bloqueos,
  Sincronizaciones, Alertas ni Asistente — solo su entrada de navegación.

## Tokens de diseño

- **Tipografía**: encabezados `Manrope` (600–800), cuerpo `Source Sans 3` (400–600),
  cargadas desde Google Fonts.
- **Color base**: fondo `#f4f5f8`, texto principal `#1c2130`.
- **Sidebar**: fondo `#1c2434`, item activo `#2a3444`, texto inactivo `#b6bcce`, texto activo `#eef0f6`.
- **Acento primario** (CTA, iconos activos): `#3d4fb8`, hover `#2c3a94`.
- **Tarjetas/tabla**: fondo `#ffffff`, borde `#e6e8ef`, radio `12px`.
- **Estados de reserva**: confirmada `bg #e6f4ea / texto #2f8f5b`, pendiente
  `bg #fdf1e2 / texto #b5702a`, cancelada `bg #fbe9e7 / texto #c25b4c`.
- **Badge de alertas**: `#c25b4c` sobre blanco.

## Navegación (mismas rutas que `admin-shell.tsx`, más 2 nuevas)

Resumen · Calendario · Reservas · **Clientes** (nueva) · **Pagos** (nueva) · Bloqueos ·
Sincronizaciones · Alertas · Asistente.

## Breakpoints (alineados a `app/globals.css` `@theme`)

| Mockup  | Ancho diseñado | Token del proyecto |
|---------|---------------:|---------------------|
| Mobile  | 390px          | cerca de `--breakpoint-phone` (375px) |
| Tablet  | 834px          | entre `--breakpoint-tablet` (768px) y `--breakpoint-laptop` (1024px) |
| Desktop | 1440px         | `--breakpoint-desktop` (1440px) |

En tablet el sidebar de texto se colapsa a un riel de solo iconos (64px). En mobile
el sidebar desaparece y se reemplaza por una barra de navegación inferior fija de
5 accesos (Resumen, Calendario, Reservas, Alertas, Más) más un botón "Actualizar
datos" de ancho completo bajo el encabezado.

## Feedback de carga (aplicar en todas las pantallas que consulten la DB)

- **Skeletons**: bloques con shimmer (`linear-gradient` animado, ver `.p1-skel` /
  `.p1t-skel` / `.p1m-skel` en cada archivo fuente) en lugar del contenido real
  mientras carga — tanto en tarjetas KPI como en filas de tabla/lista.
- **Botón con carga**: el botón "Actualizar datos" cambia su ícono por un spinner
  y se deshabilita mientras `loading` es verdadero; nunca reemplaza el texto por un
  spinner solo (mantiene el label o pasa a "Actualizando…").
- **Transiciones**: solo en hover de filas/botones/nav (150–200ms) y un fade-in muy
  sutil (translateY 5–7px, 280–360ms) al mostrar tarjetas con datos reales. Nada de
  animación decorativa; es una herramienta de uso interno.
