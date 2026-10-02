// Script de una sola ejecución: elimina todas las reservas cuyo huésped es
// el placeholder "Huesped Airbnb" (creado por
// src/features/channel-calendar-sync/guest-placeholder.ts para reservas
// sincronizadas desde Airbnb sin datos reales de huésped). El dueño del
// producto determinó que estas reservas no están aportando y deben
// eliminarse.
//
// No es código de la aplicación: se ejecuta manualmente contra un
// DATABASE_URL real, nunca desde Next.js.
//
// Uso:
//   node scripts/delete-huesped-airbnb-reservations.mjs             # simulación, no escribe nada
//   node scripts/delete-huesped-airbnb-reservations.mjs --commit    # ejecuta la eliminación real
//
// Requiere DATABASE_URL en el entorno (.env.local no se carga automáticamente
// - expórtalo primero, ej. `set -a; source .env.local; set +a`).

import postgres from "postgres";

function requireRealDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || /mock/i.test(databaseUrl)) {
    throw new Error(
      "DATABASE_URL debe estar definida en el entorno con un valor real (no mock). " +
        "Este script nunca se ejecuta contra el contexto simulado de la aplicación."
    );
  }
  return databaseUrl;
}

// Orden que respeta el grafo de llaves foráneas (todas "restrict") de
// src/persistence/schema.ts: primero lo que depende de payments/reservations,
// luego reservations, y por último los huéspedes que queden sin ninguna
// reserva u hold apuntándolos.
async function deleteForGuests(sql, guestIds) {
  const reservationRows = await sql`
    select id from reservations where guest_id in ${sql(guestIds)}
  `;
  const reservationIds = reservationRows.map((r) => r.id);

  if (reservationIds.length === 0) {
    return { reservationsDeleted: 0, guestsDeleted: 0 };
  }

  await sql`
    delete from payment_events
    where payment_id in (select id from payments where reservation_id in ${sql(reservationIds)})
  `;
  await sql`delete from payments where reservation_id in ${sql(reservationIds)}`;
  await sql`delete from reservation_items where reservation_id in ${sql(reservationIds)}`;
  await sql`delete from channel_sync_tasks where reservation_id in ${sql(reservationIds)}`;
  await sql`delete from notification_outbox where reservation_id in ${sql(reservationIds)}`;
  await sql`delete from operational_alerts where reservation_id in ${sql(reservationIds)}`;

  const deletedReservations = await sql`
    delete from reservations where id in ${sql(reservationIds)} returning id
  `;

  // Solo se eliminan los huéspedes placeholder que quedan sin ninguna
  // reserva ni hold pendiente apuntándolos (evita borrar un huésped que por
  // alguna razón se reutilizó).
  const orphanGuests = await sql`
    select g.id from guests g
    where g.id in ${sql(guestIds)}
      and not exists (select 1 from reservations r where r.guest_id = g.id)
      and not exists (select 1 from reservation_holds h where h.guest_id = g.id)
  `;
  let deletedGuests = [];
  if (orphanGuests.length > 0) {
    deletedGuests = await sql`
      delete from guests where id in ${sql(orphanGuests.map((g) => g.id))} returning id
    `;
  }

  return {
    reservationsDeleted: deletedReservations.length,
    guestsDeleted: deletedGuests.length,
  };
}

async function main(argv) {
  const commit = argv.includes("--commit");
  const databaseUrl = requireRealDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const guests = await sql`
      select id, first_name, last_name, email from guests
      where first_name = 'Huesped' and last_name = 'Airbnb'
    `;

    if (guests.length === 0) {
      console.log('No se encontraron huéspedes "Huesped Airbnb". Nada que hacer.');
      return;
    }

    const guestIds = guests.map((g) => g.id);
    const reservations = await sql`
      select id, public_id, check_in, check_out, status, total_clp
      from reservations
      where guest_id in ${sql(guestIds)}
      order by check_in
    `;

    console.log(`Huéspedes "Huesped Airbnb" encontrados: ${guests.length}`);
    console.log(`Reservas asociadas a eliminar: ${reservations.length}`);
    for (const r of reservations) {
      console.log(`  ${r.public_id} · ${r.check_in} → ${r.check_out} · ${r.status} · $${r.total_clp}`);
    }

    if (!commit) {
      console.log(
        "\nSimulación completa. Nada fue escrito en la base de datos. Ejecuta con --commit para aplicar la eliminación."
      );
      return;
    }

    const result = await sql.begin(async (tx) => deleteForGuests(tx, guestIds));

    console.log(`\n=== Eliminación aplicada ===`);
    console.log(`Reservas eliminadas: ${result.reservationsDeleted}`);
    console.log(`Huéspedes placeholder eliminados: ${result.guestsDeleted}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  });
}

export { deleteForGuests, requireRealDatabaseUrl };
