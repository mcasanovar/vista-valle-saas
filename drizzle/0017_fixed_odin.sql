ALTER TABLE "company_quotation_lines" ADD COLUMN "guest_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Guest occupancy per line was never captured before this column existed.
-- A constant default (rather than a data backfill) lets existing rows get
-- a valid, always-in-range value without any DML in this migration; new
-- quotations always write their real, authoritative guest_count.
ALTER TABLE "company_quotation_lines" ALTER COLUMN "guest_count" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "company_quotation_lines" ADD CONSTRAINT "company_quotation_lines_guest_count_within_capacity" CHECK ("company_quotation_lines"."guest_count" > 0 AND "company_quotation_lines"."guest_count" <= "company_quotation_lines"."capacity_snapshot" * "company_quotation_lines"."quantity");
