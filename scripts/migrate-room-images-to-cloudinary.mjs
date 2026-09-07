// One-off migration for the Supabase Storage -> Cloudinary switch
// (openspec/changes/manage-room-gallery-images). Copies every existing
// `room_images` object out of the Supabase Storage `room-images` bucket and
// re-uploads it to Cloudinary under the same `storage_path`, so
// `getPublicUrl()` (now Cloudinary-backed) keeps resolving for photos that
// were already live before this change. Idempotent: re-running it just
// re-uploads (overwrite) the same Cloudinary public IDs.
//
// Usage:
//   set -a; source .env.local; set +a
//   node scripts/migrate-room-images-to-cloudinary.mjs
//
// Requires DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to be
// real, non-mock values. Does not modify Postgres: `storage_path` values are
// reused as-is, only the underlying object storage changes.

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

for (const [name, value] of Object.entries(env)) {
  if (!value || /mock|unset-|REPLACE_WITH|YOUR_/i.test(value)) {
    throw new Error(`${name} must be set to a real, non-mock value`);
  }
}

const contentTypeByExtension = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

cloudinary.config({
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  secure: true,
});

const sql = postgres(env.DATABASE_URL, { max: 1 });
const storage = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
}).storage.from("room-images");

function toPublicId(storagePath) {
  return `room-images/${storagePath.replace(/\.[^./]+$/, "")}`;
}

try {
  const rows = await sql`select room_id, storage_path from room_images order by room_id, position`;
  if (rows.length === 0) {
    console.log("No room_images rows found; nothing to migrate.");
  }

  for (const row of rows) {
    const { data, error } = await storage.download(row.storage_path);
    if (error) {
      console.error(`Skipping ${row.storage_path}: download failed (${error.message})`);
      continue;
    }

    const extension = row.storage_path.split(".").pop()?.toLowerCase();
    const contentType = contentTypeByExtension[extension] ?? "application/octet-stream";
    const bytes = Buffer.from(await data.arrayBuffer());

    await cloudinary.uploader.upload(
      `data:${contentType};base64,${bytes.toString("base64")}`,
      { overwrite: true, public_id: toPublicId(row.storage_path), resource_type: "image" }
    );

    console.log(`Migrated ${row.storage_path} (room ${row.room_id}, ${bytes.byteLength} bytes)`);
  }

  console.log(`Done. ${rows.length} object(s) processed.`);
} finally {
  await sql.end({ timeout: 5 });
}
