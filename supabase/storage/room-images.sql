-- Declarative artifact only. Do not execute automatically.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-images', 'room-images', true, 5242880, array['image/avif', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already ships with row level security enabled by Supabase;
-- the owning role for this connection cannot ALTER it, and does not need to.

drop policy if exists "public_read_room_images" on storage.objects;

create policy "public_read_room_images" on storage.objects for select to public using (bucket_id = 'room-images');
-- No INSERT, UPDATE, or DELETE policy is granted to public/authenticated roles.
