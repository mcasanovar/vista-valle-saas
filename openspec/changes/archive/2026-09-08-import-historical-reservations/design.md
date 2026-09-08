## Context

Ver `proposal.md` — Why. Esta sección solo recoge las restricciones que dan forma al enfoque.

La planilla `scripts/vista-valle-historial.xlsx`, pestaña `homologado`, contiene 696 reservas repartidas en **tres bloques que no están apilados verticalmente**:

```
        C ─────────────── O          Q ─────────────── AC
  6   ┌─────── 2024 ───────┐    ┌─────── 2025 ───────┐   títulos (celdas combinadas)
  7   │ encabezados        │    │ encabezados        │
  8   │                    │    │                    │
      │  216 filas         │    │  272 filas         │
 225  └────────────────────┘    │                    │
 226  ┌─────── 2026 ───────┐    │                    │
 227  │ encabezados        │    └────────────────────┘  hasta la fila 281
 228  │  208 filas         │
 435  └────────────────────┘
```

Restricciones del esquema vigente (`src/persistence/schema.ts`) que condicionan el import:

| restricción | efecto sobre el import |
|---|---|
| `reservation_items_nightly_price_positive` (`> 0`) | 43 filas con valor por noche en cero necesitan relleno |
| `reservations_total_non_negative` (`>= 0`) | 1 fila con total negativo necesita corrección |
| `reservations_interval_valid` (`check_out > check_in`) | las fechas invertidas o nulas deben sanearse o rechazarse |
| `guests.email` y `guests.phone` `NOT NULL` | la planilla solo trae el nombre del cliente |
| todas las claves foráneas con `onDelete: restrict` | la limpieza tiene un orden obligatorio |
| `reservations_public_id_unique` | permite idempotencia sin agregar columnas |

Dos hechos del código determinan cómo se traduce el estado de cada fila:

- **La ocupación considera solo `status = 'confirmed'`** (`src/infrastructure/database/room-lock.ts`, reutilizado por `availability-source.ts`). Una reserva `completed` no bloquea la habitación.
- **Los ingresos del panel se agregan desde `payments` con `status = 'approved'`**, no desde `reservations.total_clp` (`src/infrastructure/database/admin-dashboard-summary-source.ts`). Sin filas de pago, el historial importado mostraría cero.

## Goals / Non-Goals

**Goals:**

- Ejecutar la carga como una operación única, reproducible y auditable, con un reporte que permita verificar fila por fila qué se corrigió y qué se descartó.
- Sanear los defectos de la planilla con reglas generales verificables, y no con una lista de parches, reservando las correcciones puntuales para lo que ninguna regla explica.
- No introducir dependencias nuevas ni tocar el código de la aplicación.

**Non-Goals:**

- No se construye una interfaz de carga en el panel administrativo: es una operación de una sola vez.
- No se modela el histórico de precios ni la reconciliación de comisiones de las plataformas; las columnas de servicio adicional, comisión, descuentos y total bruto se ignoran por decisión del dueño del producto.
- No se corrige la planilla de origen; el script la lee tal cual y deja constancia de sus defectos.
- No se agregan columnas ni migraciones al esquema.

## Decisions

### 1. Lector `.xlsx` propio en vez de una dependencia

El proyecto no tiene ninguna librería de Excel. Un `.xlsx` es un ZIP con XML: descomprimir, resolver `sharedStrings.xml`, ubicar la hoja por su nombre en `workbook.xml` más `workbook.xml.rels`, y leer las celdas del rango. Son unas 60 líneas y ya se validó contra este archivo concreto durante la exploración.

**Alternativas consideradas:** agregar `xlsx` o `exceljs` como dependencia de desarrollo — se descarta porque queda en el manifiesto para siempre por un script que se ejecuta una vez; pedir un CSV exportado a mano — se descarta porque el paso manual de exportación es justamente donde se pierden los bloques laterales de 2025.

**Trade-off aceptado:** el lector solo cubre lo que este archivo usa (cadenas compartidas, números, celdas combinadas para los títulos). No es un parser general y no debe reutilizarse como tal.

### 2. El estado de la reserva se deriva del estado de pago **y** de la fecha

La planilla mezcla en una sola columna el ciclo de vida de la reserva y el del pago. La traducción separa ambos ejes y usa la fecha de salida como discriminante:

```
                              hoy
                               │
  ────────── pasado ───────────┼────────── futuro ──────────
   Pagado    → completed       │   Pagado    → confirmed
              + pago approved  │              + pago approved
   Pendiente → completed       │   Pendiente → confirmed
              + pago pending   │              + pago pending
   Cancelado → cancelled, sin pago (en cualquier fecha)
```

Esto importa: de las 8 filas `Pendiente`, 4 son estadías de septiembre 2026 que todavía no terminan. Si entraran como `completed` no bloquearían la habitación y el sitio podría revenderla.

**Alternativa considerada:** importar todo como `completed` por tratarse de "historia". Se descarta porque la planilla contiene reservas vigentes.

### 3. Se insertan pagos, no solo reservas

Cada fila `Pagado` genera un pago `approved` y cada `Pendiente` uno `pending`, con `amount_clp` igual al total neto y `received_at` igual a la fecha de salida. Las canceladas no generan pago.

Campos del pago: `provider = 'historical_import'`, `mode = 'pay_at_property'`, `external_reference = 'import:<publicId>'`, `provider_payment_id` nulo. El índice único `payments_provider_payment_unique` no colisiona porque los nulos no chocan en Postgres.

Sin esto el panel mostraría $0 de ingresos para los tres años. Con esto quedan visibles:

```
  2024   $ 8.584.994
  2025   $12.266.732
  2026   $11.234.214
  ───────────────────
  total  $32.085.940
```

`received_at` usa la fecha de salida y no la de entrada porque es el momento en que el dinero efectivamente quedó percibido, y es lo que hace que los cortes por rango del panel ubiquen cada ingreso en su temporada.

### 4. Saneamiento por reglas generales, con una lista corta de excepciones

El pipeline aplica las reglas en este orden, y el orden importa:

```
  1. correcciones explícitas   (por bloque + fila, con verificación de contenido)
         │
  2. reparación de año         año fuera de rango → año del bloque, conservando día/mes
         │                     se valida contra la columna de noches, o se rechaza
  3. prioridad de las noches   si noches > 0 y (salida − entrada) ≠ noches
         │                        → salida = entrada + noches
  4. validación final          intervalo positivo, total ≥ 0, valor por noche > 0
```

La **regla 2** salió de observar que todas las fechas corruptas comparten el mismo defecto: día y mes correctos, año arruinado (`410567` → `3024-02-03`, `41667` → `2014-01-28`, `46793` → `2028-02-10`). Corregir solo el año reproduce exactamente las fechas que el dueño del producto confirmó de memoria, y en los tres casos de 2028 el resultado cuadra con la columna de noches. La regla se autovalida: si el resultado no cuadra, la fila se rechaza en vez de adoptarse.

La **regla 3** salió de una verificación sobre las 696 filas: en las 12 donde la cantidad de noches discrepa del intervalo de fechas, el total neto coincide con `valor × noches` en **12 de 12**, y con `valor × (salida − entrada)` en ninguna. Es decir, lo que está mal tipeado es la fecha de salida, no las noches. En el archivo completo, 573 de 650 filas evaluables cumplen `neto = valor × noches`; las 77 restantes son de Booking con comisión descontada, donde manda el neto.

Con esas dos reglas, solo quedan **cinco excepciones** que ninguna regla explica:

| bloque·fila | cliente | corrección |
|---|---|---|
| 2024 · f18 | Pia Ramirez | fechas `2024-01-04` → `2024-01-05` (la entrada es el serial `1`, sin día ni mes rescatables) |
| 2025 · f167 | Octavio Leyton | fechas `2025-05-01` → `2025-05-02` (la regla 3 corregiría la salida, pero la errónea es la entrada) |
| 2026 · f435 | Franco Beltrán | fechas `2026-09-07` → `2026-09-08` (mismo caso) |
| 2024 · f142 | Cobs Valencia | total y valor por noche `$38.802` (la planilla trae `−$31.570`) |
| 2024 · f165 | Jose Fuster | valor por noche `$38.802`, 1 noche por fechas (la planilla trae `$47` y 0 noches) |

Cada corrección se declara junto a una huella del contenido esperado de su fila. Si la planilla cambió, el script aborta antes de tocar la base en lugar de aplicar una corrección a la fila equivocada.

**Alternativa considerada:** una tabla de 13 parches, uno por fila defectuosa. Se descarta porque no es auditable y porque oculta que el defecto es sistemático; las reglas generales además protegen contra filas defectuosas que nadie revisó.

### 5. Mediana, no promedio, para los valores por noche ausentes

Las 43 filas con valor por noche en cero se rellenan con la mediana de su pieza y año:

| año · pieza | muestra | mediana | filas a rellenar |
|---|---|---|---|
| 2024 · chica | 72 | $33.296 | 4 |
| 2024 · grande | 130 | $35.000 | 10 |
| 2025 · chica | 105 | $40.385 | 12 |
| 2025 · grande | 120 | $40.103 | 17 |

Se usa la mediana porque el promedio queda sesgado por los ceros vecinos y algunos valores atípicos. El valor es cosmético: 41 de las 43 filas son canceladas y no generan pago, así que el número inventado nunca entra a los ingresos. Las dos excepciones (`f142` y `f165`) tienen corrección explícita.

No hace falta mediana para la pieza extra grande: no aparece en 2024 y ninguna de sus filas tiene valor en cero.

### 6. Identificador público determinista

La idempotencia se apoya en el índice único `reservations_public_id_unique`, sin agregar columnas. El identificador se deriva de un hash estable de `(bloque, fila, cliente, entrada, salida, pieza)`, formateado como UUID v4 forzando los nibbles de versión y variante para satisfacer `isPublicReservationId()` (`src/features/reservations/create-pay-at-property-reservation.ts`).

**Alternativas consideradas:** una columna `import_key` con índice único — es más honesta semánticamente, pero exige una migración del esquema por una operación única; `external_platform`/`external_ref` — no sirve, porque `external_platform` está restringido al enum `channel` (`airbnb`|`booking`) y un check exige ambos campos o ninguno, lo que deja fuera a las 330 filas de WhatsApp, además de contaminar la semántica de la sincronización de canales.

**Trade-off aceptado:** un `VV-<uuid>` que parece aleatorio pero no lo es. Queda documentado en el encabezado del script.

### 7. Limpieza e inserción en una sola transacción

Todas las claves foráneas usan `onDelete: restrict`, así que el borrado tiene un orden obligatorio:

```
  1. payment_events
  2. payments                  ← apunta a reservations y a reservation_holds
  3. reservation_items
  4. channel_sync_tasks
  5. notification_outbox
  6. operational_alerts
  7. reservations
  8. reservation_holds
  9. guests
 10. room_blocks              ← apunta a assistant_interactions
 11. assistant_interactions
 12. audit_events
 13. company_quotation_lines
 14. company_quotations
```

Se preservan `rooms`, `room_images`, `amenities`, `room_amenities`, `company_quotation_breakfast_catalog` y `channel_connections`. Estas últimas guardan el `outbound_token` que identifica los calendarios `.ics` ya publicados en Airbnb y Booking: borrarlas invalidaría enlaces que las plataformas externas siguen consultando.

No se toma respaldo previo, por decisión explícita del dueño del producto: todo el contenido actual es de prueba. La red de seguridad es la transacción única — si la inserción falla, el borrado se revierte con ella.

### 8. Modo simulado por omisión

Sin `--commit` el script no borra ni escribe: lee, homologa, valida y reporta. El reporte incluye el desglose por año, estado y pieza, la lista de filas corregidas con la regla aplicada, y la lista de filas rechazadas con su motivo.

## Risks / Trade-offs

- **La limpieza es irreversible y sin respaldo** → la transacción única evita estados intermedios, y el modo simulado por omisión obliga a una confirmación explícita antes de cualquier borrado.
- **Quedan noches con doble reserva en la planilla** → tras aplicar las reglas de saneamiento, los solapes reales bajan de 131 pares a unas 15 noches (10 en matrimonial, 4 en individual, 1 en doble) en dos años y medio. La base no tiene restricción de exclusión, así que el import las inserta igual; el script las lista en el reporte para revisión manual posterior. No se rechazan: son estadías reales que ocurrieron.
- **Las correcciones explícitas envejecen si la planilla se edita** → cada una verifica una huella del contenido de su fila y aborta la ejecución completa si no calza.
- **El lector `.xlsx` es específico de este archivo** → se documenta como tal en el encabezado del script; no se expone como utilidad reutilizable.
- **La ocupación pasada llega al calendario administrativo** → las reservas `completed` no bloquean disponibilidad pero sí aparecen en el calendario, que solo excluye las canceladas. Es el comportamiento deseado: el calendario debe mostrar la historia.
- **El identificador determinista con forma de UUID puede confundir** → queda documentado en el script y en esta decisión.

## Migration Plan

1. Ejecutar en modo simulado contra la base de producción y revisar el reporte: totales por año, filas corregidas y filas rechazadas.
2. Corregir en la planilla lo que el reporte marque como rechazado, si corresponde, y repetir el paso 1.
3. Ejecutar con `--commit`.
4. Verificar en el panel administrativo: ingresos por año, cobros pendientes con las 4 estadías vigentes de septiembre 2026, y el calendario de esas fechas.
5. Verificar que la búsqueda pública de disponibilidad no ofrezca las fechas ocupadas por las reservas vigentes importadas.

**Rollback:** no hay vuelta atrás una vez confirmada la transacción, por la ausencia deliberada de respaldo. La mitigación es el paso 1, que debe repetirse hasta que el reporte no muestre sorpresas.
