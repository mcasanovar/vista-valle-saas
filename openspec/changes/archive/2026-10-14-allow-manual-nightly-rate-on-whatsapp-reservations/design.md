## Context

Ver `proposal.md` - Why.

Toda la decisión de elegibilidad vive hoy en un único módulo, `src/features/reservations/reservation-rate-eligibility.ts`, que exporta una lista (`externalChannelOrigins = ["airbnb", "booking"]`), dos predicados y una aserción de servidor. Los cuatro caminos que tocan un valor por noche —la creación manual (`src/features/admin/manual-reservation.ts`), la edición posterior (`src/features/reservations/edit-reservation-nightly-rates.ts`), la corrección de origen (`src/features/reservations/edit-reservation-origin.ts`) y las dos puertas de interfaz— lo consultan desde ahí, así que el cambio de comportamiento es, en esencia, un elemento más en esa lista.

Dos restricciones condicionan el resto:

1. **"Canal externo" ya significa otra cosa en el código.** `ExternalReservationPlatform` y el enum Drizzle `channel` designan las plataformas con las que el sistema sincroniza calendarios: Airbnb y Booking, nada más. El módulo de elegibilidad reutilizó ese vocabulario porque los dos conjuntos coincidían. Con WhatsApp dentro dejan de coincidir, y un nombre `externalChannelOrigins` que incluya WhatsApp induciría exactamente el error que la separación debe evitar (por ejemplo, abrir una conexión de sincronización para una reserva de WhatsApp).
2. **La página de detalle usa una sola condición para dos preguntas distintas.** En `app/(admin-protected)/admin/reservas/[id]/page.tsx`, la variable local `isExternalChannelOrigin` decide a la vez si se muestra el formulario de valor por noche y si se muestra el aviso "editar esta estadía no se refleja en Airbnb/Booking". La primera pregunta pasa a incluir WhatsApp; la segunda no, porque no hay plataforma externa que se quede desinformada.

No hay migración de base de datos: `reservation_items.nightly_price_manual` ya existe por línea y `whatsapp` ya es un valor del enum `reservation_origin`.

## Goals / Non-Goals

**Goals:**

- Que el conjunto de orígenes elegibles siga siendo un único punto de verdad, consultado por el servidor en cada operación y por la interfaz solo como conveniencia.
- Que el vocabulario del código distinga la elegibilidad del valor por noche de la noción de plataforma sincronizable, para que un tercer cambio sobre cualquiera de las dos no arrastre a la otra.

**Non-Goals:**

- Tocar `channel-calendar-sync`, `ExternalReservationPlatform` o el enum `channel`. WhatsApp no sincroniza calendarios y no pasa a hacerlo.
- Extender la elegibilidad a `phone`, `website` o `admin`, ni dejar preparada esa extensión con un parámetro de configuración. Si más adelante se decide, el cambio vuelve a ser un elemento en la lista.
- Cambiar el modelo de datos, las reglas de validación del monto, el criterio de conciliación de pagos o el formato de auditoría. Las reservas de WhatsApp pasan por el mismo código que las de Airbnb.

## Decisions

### 1. Renombrar el criterio por lo que decide, en lugar de añadir WhatsApp a un nombre que lo desmiente

`reservation-rate-eligibility.ts` pasa a exportar:

| Antes | Después |
| --- | --- |
| `externalChannelOrigins` | `manualNightlyRateOrigins` |
| `ExternalChannelOrigin` | `ManualNightlyRateOrigin` |
| `isExternalChannelOrigin` | `allowsManualNightlyRate` |
| `isExternalChannelReservation` | `reservationAllowsManualNightlyRate` |
| `assertExternalChannelReservation` | `assertManualNightlyRateAllowed` |
| `ReservationNotExternalChannelError` (`RESERVATION_NOT_EXTERNAL_CHANNEL`) | `ManualNightlyRateNotAllowedError` (`MANUAL_NIGHTLY_RATE_NOT_ALLOWED`) |

**Alternativa considerada:** dejar los nombres y solo añadir `"whatsapp"` a la lista. Es un diff de una línea, y fue descartada porque deja el código afirmando algo falso justo donde más cuesta caro: el módulo que decide dinero, al lado de otro conjunto —las plataformas sincronizables— que sí es exactamente Airbnb y Booking. El renombre es mecánico (seis símbolos, nueve archivos, ningún cambio de forma) y el módulo documenta en un comentario por qué los dos conjuntos ya no coinciden.

El código de error es interno: solo lo consume `edit-reservation-nightly-rates-core.ts`, que lo traduce a un mensaje en español, y los tests. No viaja al navegador ni se persiste, así que renombrarlo no rompe ningún contrato externo.

### 2. Separar, en la página de detalle, la puerta del formulario del aviso de plataforma externa

La variable única se divide en dos:

- `allowsManualRate` — derivada de `allowsManualNightlyRate(reservation.origin)`, decide si se renderiza `EditReservationNightlyRatesForm`.
- `isExternalPlatformOrigin` — sigue siendo `airbnb || booking`, decide el aviso "editar la estadía no se refleja en la plataforma" y el `externalChannelLabel` que recibe `EditReservationStayForm`.

**Alternativa considerada:** usar la misma condición para ambas cosas y aceptar el aviso en WhatsApp. Descartada porque el aviso sería literalmente falso: una reserva de WhatsApp no tiene plataforma a la que el cambio deba reflejarse, y un aviso falso en el camino de edición financiera erosiona la confianza en los avisos que sí importan.

### 3. Hacer neutrales respecto al origen los textos que hoy dicen "canal"

"Registra lo que cobró el canal" y "Valor por noche del canal" pasan a nombrar el valor sin atribuirlo a un canal ("Registra el valor por noche acordado", "Valor por noche acordado"). El texto ya es el mismo para Airbnb y Booking; ahora también lo es para WhatsApp, y sigue siendo correcto en los tres casos.

### 4. La corrección de origen hacia WhatsApp pasa a ser una relabelación pura

`correctionDropsManualRates` ya está escrita en términos del predicado de elegibilidad, no de una lista propia, así que incluir WhatsApp en la lista hace automáticamente que corregir de Booking a WhatsApp conserve el valor fijado a mano, no toque pagos y no muestre advertencia. No hace falta código nuevo; sí hace falta cubrirlo con un test, porque hoy ningún test ejercita una corrección entre un canal y WhatsApp.

### 5. La prueba de cobertura del enum se mantiene como guardia

`tests/reservation-rate-eligibility.test.ts` enumera los seis valores de `reservation_origin` y afirma el conjunto elegible exacto, de modo que un séptimo origen agregado al esquema rompe el test hasta que alguien decida su elegibilidad. Esa propiedad se conserva: solo cambia el conjunto esperado, de `["airbnb", "booking"]` a `["airbnb", "booking", "whatsapp"]`.

## Risks / Trade-offs

- **El renombre toca nueve archivos y veinte-y-tantos puntos de uso; un símbolo olvidado rompe la compilación, no el comportamiento.** → TypeScript lo detecta de inmediato. La verificación es `npm run typecheck` más la suite, y el renombre no deja ningún alias de compatibilidad que pudiera dejar vivo un camino viejo sin que nadie lo note.
- **Riesgo de que alguien lea la nueva lista como "orígenes que sincronizan" y abra una conexión de canal para WhatsApp.** → El módulo de elegibilidad documenta explícitamente que `ExternalReservationPlatform` es el conjunto de plataformas sincronizables y que ya no coincide con este; el nombre nuevo no sugiere sincronización.
- **Un administrador podría fijar a mano el valor de una reserva de WhatsApp y después corregir su origen a teléfono sin advertir que el valor se descarta.** → El comportamiento es el que ya existe para Airbnb y Booking, y la advertencia previa a confirmar ya cubre ese caso porque se deriva del mismo predicado. Se añade un test del camino WhatsApp → teléfono.
- **Las reservas de WhatsApp ya creadas con la tarifa vigente no se corrigen solas.** → Es lo esperado: el administrador ahora puede editarlas una por una desde el detalle, sin restricción por estado, y cada edición queda auditada. No se hace ninguna corrección masiva retroactiva.

## Migration Plan

Despliegue en un solo paso, sin migración de esquema ni de datos. La elegibilidad se evalúa en cada petición, así que al desplegar las reservas de WhatsApp existentes pasan a admitir la edición sin que nada en ellas cambie. Para revertir basta con volver a la versión anterior: una reserva de WhatsApp que haya quedado con `nightly_price_manual = true` conserva su valor y su total —la edición de estadía respeta el valor manual con independencia del origen—, y lo único que se pierde es la posibilidad de volver a editarlo desde el detalle, además de que una corrección de origen posterior lo descartaría.
