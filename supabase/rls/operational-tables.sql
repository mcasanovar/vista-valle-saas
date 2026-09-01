-- Declarative artifact only. Apply and verify in the production-readiness workflow.
alter table public.rooms enable row level security;
alter table public.room_images enable row level security;
alter table public.amenities enable row level security;
alter table public.room_amenities enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.reservation_holds enable row level security;
alter table public.room_blocks enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.channel_sync_tasks enable row level security;
alter table public.audit_events enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.assistant_interactions enable row level security;
alter table public.company_quotations enable row level security;
alter table public.company_quotation_lines enable row level security;

alter table public.rooms force row level security;
alter table public.room_images force row level security;
alter table public.amenities force row level security;
alter table public.room_amenities force row level security;
alter table public.guests force row level security;
alter table public.reservations force row level security;
alter table public.reservation_items force row level security;
alter table public.reservation_holds force row level security;
alter table public.room_blocks force row level security;
alter table public.payments force row level security;
alter table public.payment_events force row level security;
alter table public.channel_sync_tasks force row level security;
alter table public.audit_events force row level security;
alter table public.notification_outbox force row level security;
alter table public.assistant_interactions force row level security;
alter table public.company_quotations force row level security;
alter table public.company_quotation_lines force row level security;

revoke all privileges on table public.rooms, public.room_images, public.amenities, public.room_amenities, public.guests, public.reservations, public.reservation_items, public.reservation_holds, public.room_blocks, public.payments, public.payment_events, public.channel_sync_tasks, public.audit_events, public.notification_outbox, public.assistant_interactions, public.company_quotations, public.company_quotation_lines from anon, authenticated;
