CREATE TYPE "public"."channel_connection_poll_status" AS ENUM('ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."channel_payment_behavior" AS ENUM('auto_approved', 'pay_at_property');--> statement-breakpoint
CREATE TABLE "channel_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"platform" "channel" NOT NULL,
	"payment_behavior" "channel_payment_behavior" NOT NULL,
	"inbound_feed_url" text,
	"outbound_token" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_poll_status" "channel_connection_poll_status",
	"last_poll_event_count" integer,
	"last_poll_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_connections_poll_result_consistent" CHECK ("channel_connections"."last_polled_at" IS NULL OR "channel_connections"."last_poll_status" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "external_platform" "channel";--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "external_ref" varchar(200);--> statement-breakpoint
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connections_room_platform_unique" ON "channel_connections" USING btree ("room_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connections_outbound_token_unique" ON "channel_connections" USING btree ("outbound_token");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_external_platform_ref_unique" ON "reservations" USING btree ("external_platform","external_ref");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_external_ref_consistent" CHECK (("reservations"."external_platform" IS NULL) = ("reservations"."external_ref" IS NULL));