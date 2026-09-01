# Room image storage boundary

`contracts.ts` defines the room-image port: public URL lookup, metadata listing, and server-side upload/removal. Every object must be under `rooms/<room UUID>/`, use a safe filename and a MIME-matching `avif`, `jpg`, `jpeg`, `png`, or `webp` extension. Upload bytes are validated before an adapter sees them; the maximum is 5 MiB.

`mock.ts` starts empty and isolates each in-memory map. It has no commercial images and makes no network request. `server.ts` is server-only: the explicit `mock` context returns that map without instantiating a Storage SDK client. In `production`, the service-role client is created lazily and keeps provider failures free of provider payloads or credentials. Application authorization must precede any production write in the calling service; that authorization arrives in later slices.

[room-images.sql](../../../supabase/storage/room-images.sql) is declarative only and is not executed by this repository. It creates/configures the public `room-images` bucket idempotently, enables RLS, and grants only public `SELECT` access to its objects.
