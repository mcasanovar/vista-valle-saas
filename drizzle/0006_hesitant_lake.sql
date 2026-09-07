ALTER TYPE "public"."notification_status" ADD VALUE 'retrying' BEFORE 'delivered';--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "next_attempt_at" timestamp with time zone;