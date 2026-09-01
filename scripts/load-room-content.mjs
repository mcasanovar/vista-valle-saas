// Idempotent loader for real Vista Valle room content (task 6 of
// openspec/changes/configure-production-supabase). Uploads each room's
// photographs to the Supabase Storage `room-images` bucket, then upserts the
// room (by slug), its amenities, and its image rows in Postgres.
//
// Usage:
//   node scripts/load-room-content.mjs scripts/room-content/rooms.json
//
// Requires DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and
// SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local is not loaded
// automatically - export them first, e.g. `set -a; source .env.local; set +a`).
// Never sets `active: true` - review published content in the admin/catalogue
// under a verification context, then flip `active` deliberately afterwards.

import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("Usage: node scripts/load-room-content.mjs <manifest.json>");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

for (const [name, value] of Object.entries({
  DATABASE_URL: databaseUrl,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
})) {
  if (!value || /mock/i.test(value)) {
    throw new Error(`${name} must be set to a real, non-mock value`);
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.rooms) || manifest.rooms.length === 0) {
  throw new Error("Manifest must declare a non-empty 'rooms' array");
}

const manifestDir = path.dirname(path.resolve(manifestPath));
const sql = postgres(databaseUrl, { max: 1 });
const storage = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
}).storage.from("room-images");

async function uploadImage(roomId, localPath, index) {
  const ext = path.extname(localPath).slice(1).toLowerCase();
  // Must match roomImagePathPattern in src/infrastructure/storage/contracts.ts:
  // rooms/<room UUID>/<file>, never the room's slug.
  const storagePath = `rooms/${roomId}/${index}.${ext}`;
  const file = await readFile(path.resolve(manifestDir, localPath));
  const contentType =
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" }[
      ext
    ] ?? "application/octet-stream";

  const { error } = await storage.upload(storagePath, file, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${localPath}: ${error.message}`);
  return storagePath;
}

async function upsertRoom(room) {
  const [{ id: roomId }] = await sql`
    insert into rooms (slug, name, description, capacity, bed_count, bed_configuration, bathroom_description, base_nightly_price_clp, active)
    values (${room.slug}, ${room.name}, ${room.description}, ${room.capacity}, ${room.bedCount}, ${room.bedConfiguration}, ${room.bathroomDescription}, ${room.nightlyPriceClp}, false)
    on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description,
      capacity = excluded.capacity,
      bed_count = excluded.bed_count,
      bed_configuration = excluded.bed_configuration,
      bathroom_description = excluded.bathroom_description,
      base_nightly_price_clp = excluded.base_nightly_price_clp,
      updated_at = now()
    returning id
  `;

  for (const amenityName of room.amenities) {
    const amenitySlug = amenityName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const [{ id: amenityId }] = await sql`
      insert into amenities (slug, name)
      values (${amenitySlug}, ${amenityName})
      on conflict (slug) do update set name = excluded.name
      returning id
    `;
    await sql`
      insert into room_amenities (room_id, amenity_id)
      values (${roomId}, ${amenityId})
      on conflict (room_id, amenity_id) do nothing
    `;
  }

  for (const [index, image] of room.images.entries()) {
    const storagePath = await uploadImage(roomId, image.file, index);
    await sql`
      insert into room_images (room_id, storage_path, alt_text, position)
      values (${roomId}, ${storagePath}, ${image.alt}, ${index})
      on conflict (room_id, position) do update set
        storage_path = excluded.storage_path,
        alt_text = excluded.alt_text
    `;
  }

  console.log(`Loaded ${room.slug} (${room.images.length} photo(s), ${room.amenities.length} amenity link(s)); active=false, review before publishing`);
}

try {
  for (const room of manifest.rooms) await upsertRoom(room);
  console.log(`Done. ${manifest.rooms.length} room(s) loaded.`);
} finally {
  await sql.end({ timeout: 5 });
}
