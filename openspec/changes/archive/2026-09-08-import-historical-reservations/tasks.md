## 1. Lectura de la planilla

- [x] 1.1 Crear `scripts/import-historical-reservations.mjs` con el encabezado que documenta el alcance de una sola vez, el identificador determinista y el lector `.xlsx` específico de este archivo; verificar que el script se ejecuta e imprime su ayuda sin conexión a la base
- [x] 1.2 Implementar el lector `.xlsx` (descompresión ZIP, `sharedStrings.xml`, resolución de la hoja por nombre vía `workbook.xml` y `workbook.xml.rels`); verificar que localiza la pestaña `homologado` y aborta informando las pestañas disponibles si no existe
- [x] 1.3 Implementar la lectura de los tres bloques (`C8:O225`, `Q8:AC281`, `C228:O435`) validando la fila de encabezados de cada uno; verificar que reporta 216, 272 y 208 filas y que aborta si algún encabezado no calza
- [x] 1.4 Implementar la conversión de seriales de Excel a fecha `YYYY-MM-DD`; verificar con los casos conocidos `45306 → 2024-01-15` y `46282 → 2026-09-17`

## 2. Homologación de campos

- [x] 2.1 Implementar el mapeo de pieza a habitación del catálogo por slug (`Chica`/`Grande`/`extra grande`), insensible a mayúsculas y espacios, resolviendo los UUID desde la base al inicio; verificar que aborta si falta alguna de las tres habitaciones
- [x] 2.2 Implementar el mapeo de plataforma a origen (`booking`, `arbnb` → airbnb, `otro` y vacío → whatsapp); verificar el desglose contra los conteos esperados: 282, 83 y 331
- [x] 2.3 Implementar la derivación de estado de reserva y estado de pago a partir del estado de la planilla y de la fecha de salida frente a la fecha de ejecución; verificar que las 4 estadías vigentes de septiembre 2026 quedan como `confirmed`
- [x] 2.4 Implementar la separación del nombre del cliente en nombre y apellido y la síntesis de correo y teléfono reconocibles del import; verificar el caso de nombre de un solo término y el rechazo de la fila sin nombre

## 3. Saneamiento

- [x] 3.1 Implementar la tabla de correcciones explícitas de las cinco filas (`2024·f18`, `2025·f167`, `2026·f435`, `2024·f142`, `2024·f165`) con verificación de huella del contenido esperado; verificar que la ejecución aborta si una huella no calza
- [x] 3.2 Implementar la reparación de año fuera de rango conservando día y mes, validando el resultado contra la columna de noches; verificar que resuelve las 6 filas afectadas y que rechaza el caso en que el resultado no cuadra
- [x] 3.3 Implementar la prioridad de la columna de noches sobre las fechas (`salida = entrada + noches` cuando discrepan y las noches son mayores que cero); verificar que corrige las 15 filas afectadas (incluye las de intervalo invertido y cero noches, que la misma condición general resuelve) y que respeta las fechas cuando las noches son cero
- [x] 3.4 Implementar el cálculo de medianas de valor por noche por pieza y año y el relleno de las 42 filas en cero (las 43 detectadas menos `2024·f142`, cubierta por su corrección explícita); verificar contra las medianas esperadas de 2024 y 2025 y que rechaza la fila si no hay muestra
- [x] 3.5 Implementar la validación final por fila (intervalo positivo, total no negativo, valor por noche positivo, pieza y estado conocidos) que separa filas aceptadas de rechazadas; verificar que ninguna fila aceptada viola un check del esquema

## 4. Reporte y modo simulado

- [x] 4.1 Implementar el reporte con desglose por año, estado y pieza, y los totales de ingresos por año; verificar que el modo simulado arroja $8.584.994, $12.266.732 y $11.234.214
- [x] 4.2 Implementar el listado de filas corregidas con la regla aplicada y el valor resultante, y el de filas rechazadas con bloque, fila, cliente y motivo; verificar que ambas listas aparecen en una ejecución simulada
- [x] 4.3 Implementar la detección y el listado de las noches con doble reserva por habitación, sin rechazarlas; verificar que reporta las ~15 noches residuales esperadas
- [x] 4.4 Implementar el modo simulado por omisión y la opción `--commit`; verificar que sin `--commit` no se ejecuta ninguna sentencia de escritura

## 5. Escritura

- [x] 5.1 Implementar la validación de entorno (`DATABASE_URL` real, rechazo de valores de prueba) siguiendo el patrón de `scripts/load-room-content.mjs`; verificar que aborta antes de leer la planilla cuando la variable falta o es simulada
- [x] 5.2 Implementar la generación del identificador público determinista con forma de UUID v4; verificar que satisface `isPublicReservationId()` y que dos ejecuciones producen el mismo identificador para la misma fila
- [x] 5.3 Implementar la limpieza en el orden de claves foráneas de las 14 tablas, preservando catálogo, imágenes, amenidades, conexiones de canal y catálogo de desayunos; verificar que tras la limpieza las tablas preservadas conservan su conteo
- [x] 5.4 Implementar la inserción de huésped, reserva, ítem y pago por fila aceptada, con `provider = 'historical_import'`, `mode = 'pay_at_property'` y `received_at` igual a la fecha de salida; verificar que las canceladas no generan pago
- [x] 5.5 Envolver limpieza e inserción en una única transacción; verificar que un fallo inducido a mitad de la inserción deja la base con su contenido previo

## 6. Verificación de extremo a extremo

- [x] 6.1 Ejecutar el import en modo simulado contra la base de producción y revisar el reporte completo con el dueño del producto
- [x] 6.2 Ejecutar con `--commit` y verificar en el panel administrativo los ingresos por año, los cobros pendientes y el calendario de septiembre 2026
- [x] 6.3 Verificar que la búsqueda pública de disponibilidad no ofrece las fechas ocupadas por las 4 reservas vigentes importadas
- [x] 6.4 Verificar la idempotencia ejecutando el import una segunda vez sobre la misma planilla y comprobando que no se crean reservas duplicadas
