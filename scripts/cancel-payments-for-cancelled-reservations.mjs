// Script de una sola ejecución: backfill del change
// cancel-reservation-cancels-payments. Ese change hace que cancelar una
// reserva cancele automáticamente sus pagos desde ahora en adelante, pero
// deliberadamente no toca retroactivamente las reservas que ya estaban
// canceladas antes de que el cambio se desplegara (ver design.md,
// "Migration Plan"). Este script aplica esa misma regla a las reservas ya
// canceladas: cualquier pago suyo que no esté en estado 'cancelled' pasa a
// 'cancelled', con un evento de auditoría por pago (antes/después,
// actor_user_id null porque lo corre un script, no un administrador).
//
// No es código de la aplicación: se ejecuta manualmente contra un
// DATABASE_URL real, nunca desde Next.js.
//
// Uso:
//   node scripts/cancel-payments-for-cancelled-reservations.mjs             # simulación, no escribe nada
//   node scripts/cancel-payments-for-cancelled-reservations.mjs --commit    # ejecuta la actualización real
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

async function findPaymentsToCancel(sql) {
  return sql`
    select
      p.id,
      p.reservation_id,
      p.status,
      p.amount_clp,
      p.provider,
      r.public_id,
      r.check_in,
      r.check_out
    from payments p
    join reservations r on r.id = p.reservation_id
    where r.status = 'cancelled'
      and p.status != 'cancelled'
    order by r.check_in
  `;
}

async function cancelPayments(sql, payments) {
  let cancelled = 0;
  for (const payment of payments) {
    await sql`
      update payments set status = 'cancelled' where id = ${payment.id}
    `;
    await sql`
      insert into audit_events (actor_user_id, action, entity_type, entity_id, before, after)
      values (
        null,
        'payment.cancelled_backfill',
        'payment',
        ${payment.id},
        ${sql.json({ status: payment.status })},
        ${sql.json({ status: "cancelled" })}
      )
    `;
    cancelled += 1;
  }
  return cancelled;
}

async function main(argv) {
  const commit = argv.includes("--commit");
  const databaseUrl = requireRealDatabaseUrl();
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const payments = await findPaymentsToCancel(sql);

    console.log(
      `Pagos de reservas canceladas que no están en 'cancelled': ${payments.length}`
    );
    for (const p of payments) {
      console.log(
        `  ${p.public_id} · ${p.check_in} → ${p.check_out} · pago ${p.id} · ${p.provider} · ${p.status} → cancelled · $${p.amount_clp}`
      );
    }

    if (payments.length === 0) {
      console.log("Nada que hacer.");
      return;
    }

    if (!commit) {
      console.log(
        "\nSimulación completa. Nada fue escrito en la base de datos. Ejecuta con --commit para aplicar la actualización."
      );
      return;
    }

    const cancelled = await sql.begin(async (tx) =>
      cancelPayments(tx, payments)
    );

    console.log(`\n=== Actualización aplicada ===`);
    console.log(`Pagos cancelados: ${cancelled}`);
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

export { cancelPayments, findPaymentsToCancel, requireRealDatabaseUrl };
