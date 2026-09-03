CREATE TYPE "public"."operational_alert_kind" AS ENUM('channel_sync_conflict');--> statement-breakpoint
CREATE TABLE "operational_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "operational_alert_kind" NOT NULL,
	"room_id" uuid,
	"reservation_id" uuid,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operational_alerts_created_at_idx" ON "operational_alerts" USING btree ("created_at");