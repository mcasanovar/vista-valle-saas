## Contexto

`src/features/admin/manual-reservation-contract.ts` es el único módulo que define la regla de fechas del flujo administrativo de creación, y lo hace delegando en la regla pública:

```ts
export function manualReservationDateMinimums(now: Date = new Date()) {
  return publicAvailabilityDateMinimums(now);
}
```

De ahí la consumen tres puntos, en los tres momentos del flujo:

1. `manual-reservation-form.tsx` — el atributo `min` de los dos controles de fecha y la validación de cliente antes de enviar.
2. `manual-reservation-availability.ts` — el BFF autenticado que resuelve qué habitaciones hay libres para las fechas elegidas.
3. `manual-reservation.ts` — la creación, justo después de construir el intervalo de dominio.

El sitio público no pasa por este contrato: `search.ts` y `results-query.ts` llaman a `publicAvailabilityDateMinimums` directamente y repiten sus propios mensajes de error. Esa duplicación, que a primera vista parece accidental, es lo que permite relajar un lado sin tocar el otro.

## Decisiones

### 1. Reducir la regla, no condicionarla con un flag

La alternativa obvia era dejar la regla en su lugar y agregarle un parámetro (`allowPastDates`, o un `now` inyectado desde el llamador administrativo). Se descarta por lo mismo que `stay-edit-availability.ts` documenta para su caso: *«un flag que relaja una regla pública es fácil de activar por error desde el flujo público»*. En su lugar, el contrato administrativo deja de expresar una regla de fechas vigentes y queda con la invariante del dominio.

El nombre `validateManualReservationDateRange` se conserva —sigue validando el rango— pero su contenido pasa a ser una sola comprobación: salida posterior a entrada. `manualReservationDateMinimums` desaparece, porque ya no hay mínimo que publicar.

### 2. La invariante de intervalo se aplica una sola vez en el servidor

Con la regla de mínimos fuera, la validación que corría en el BFF y en la creación quedaba inalcanzable: `createLodgingInterval` ya lanza `InvalidLodgingIntervalError` cuando la salida no es posterior a la entrada, y lo hace *antes*. Mantenerla habría dejado código que no puede ejecutarse fingiendo ser una defensa.

Se elimina, junto con `ManualReservationDateRangeError` y su rama en la Server Action, que existían solo para transportar esos errores de campo. La defensa autoritativa del servidor pasa a ser la invariante del dominio, que ya estaba traducida: la Server Action mapea `InvalidLodgingIntervalError` al campo `checkOut` con el mensaje «Indica una fecha de salida posterior a la entrada.», y el BFF lo convierte en «Selecciona fechas de entrada y salida válidas.».

`validateManualReservationDateRange` queda entonces como validación de cliente —el formulario detiene un intervalo invertido antes de enviarlo— sobre la misma regla que el servidor aplica por su cuenta.

### 3. Sin ventana máxima hacia atrás

Se evaluó limitar el retroceso (por ejemplo 30 días) para atajar errores de tipeo de año. Se descarta: el administrador también registra historial —ya existe un import histórico completo en el proyecto— y una ventana obligaría a elegir un número arbitrario que luego estorba. La defensa contra un año equivocado queda donde ya está: el resumen de noches y el total que el formulario muestra antes de confirmar hacen evidente un intervalo absurdo.

### 4. El `min` del control de salida pasa a ser la entrada elegida

Quitar los dos `min` dejaría al administrador sin ninguna guía y permitiría componer un intervalo invertido que solo se rechaza al enviar. El control de entrada queda sin `min` —cualquier fecha es legítima— y el de salida toma como `min` la entrada ya elegida. Es guía de interfaz, no validación: la regla autoritativa sigue siendo la del servidor, como exige la regla de ingeniería de no confiar en disponibilidad enviada por el cliente.

### 5. La disponibilidad no necesita cambios

`listOccupyingIntervals` (`src/infrastructure/database/room-lock.ts`) no filtra por fecha: trae todas las reservas confirmadas, los holds no expirados y los bloqueos activos de la habitación. Una estadía pasada, por lo tanto, compite por la habitación igual que cualquier otra y el solapamiento se detecta con el mismo predicado. Tampoco hay restricción de base de datos que impida una fecha pasada: la única sobre fechas es `reservations_check_out_after_check_in`.
