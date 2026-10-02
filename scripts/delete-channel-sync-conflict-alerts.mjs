// Script de una sola ejecución: elimina las alertas operacionales de
// conflicto de sincronización de canal ("He encontrado una reserva
// sobreduplicada para web y airbnb/booking. Revise la reserva para
// coordinar con huésped.") emitidas por
// src/features/channel-calendar-sync/conflict-alerts.ts
// (CHANNEL_SYNC_CONFLICT_MESSAGE, kind = 'channel_sync_conflict').
//
// No es código de la aplicación: se ejecuta manualmente contra un
// DATABASE_URL real, nunca desde Next.js.
//
// Uso:
//   node scripts/delete-channel-sync-conflict-alerts.mjs             # simulación, no escribe nada
//   node scripts/delete-channel-sync-conflict-alerts.mjs --commit    # ejecuta la eliminación real
//
// Requiere DATABASE_URL en el entorno (.env.local no se carga automáticamente
// - expórtalo primero, ej. `set -a; source .env.local; set +a`).

import postgres from "postgres";

const CONFLICT_MESSAGE =
  "He encontrado una reserva sobreduplicada para web y airbnb/booking. Revise la reserva para coordinar con huésped.";

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

async function main(argv) {
  const commit = argv.includes("--commit");
  const databaseUrl = requireRealDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const alerts = await sql`
      select id, kind, room_id, reservation_id, created_at
      from operational_alerts
      where message = ${CONFLICT_MESSAGE}
      order by created_at
    `;

    console.log(`Alertas encontradas: ${alerts.length}`);
    for (const a of alerts) {
      console.log(`  ${a.id} · ${a.kind} · room=${a.room_id ?? "-"} · reservation=${a.reservation_id ?? "-"} · ${a.created_at}`);
    }

    if (alerts.length === 0) {
      console.log("Nada que hacer.");
      return;
    }

    if (!commit) {
      console.log(
        "\nSimulación completa. Nada fue escrito en la base de datos. Ejecuta con --commit para aplicar la eliminación."
      );
      return;
    }

    const deleted = await sql`
      delete from operational_alerts where message = ${CONFLICT_MESSAGE} returning id
    `;

    console.log(`\n=== Eliminación aplicada ===`);
    console.log(`Alertas eliminadas: ${deleted.length}`);
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

export { requireRealDatabaseUrl, CONFLICT_MESSAGE };
