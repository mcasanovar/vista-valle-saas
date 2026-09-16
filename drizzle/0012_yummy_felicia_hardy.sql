CREATE TABLE "reservation_hold_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"nights" integer NOT NULL,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"nightly_price_clp" integer NOT NULL,
	"charges_clp" integer DEFAULT 0 NOT NULL,
	"subtotal_clp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_hold_items_nights_positive" CHECK ("reservation_hold_items"."nights" > 0),
	CONSTRAINT "reservation_hold_items_guest_count_positive" CHECK ("reservation_hold_items"."guest_count" > 0),
	CONSTRAINT "reservation_hold_items_nightly_price_positive" CHECK ("reservation_hold_items"."nightly_price_clp" > 0),
	CONSTRAINT "reservation_hold_items_charges_non_negative" CHECK ("reservation_hold_items"."charges_clp" >= 0),
	CONSTRAINT "reservation_hold_items_subtotal_non_negative" CHECK ("reservation_hold_items"."subtotal_clp" >= 0)
);
--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP CONSTRAINT "reservation_holds_guest_count_positive";--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP CONSTRAINT "reservation_holds_nightly_price_positive";--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP CONSTRAINT "reservation_holds_charges_non_negative";--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP CONSTRAINT "reservation_holds_room_id_rooms_id_fk";
--> statement-breakpoint
DROP INDEX "reservation_holds_room_interval_expiry_idx";--> statement-breakpoint
ALTER TABLE "reservation_hold_items" ADD CONSTRAINT "reservation_hold_items_hold_id_reservation_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."reservation_holds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_hold_items" ADD CONSTRAINT "reservation_hold_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_hold_items_hold_room_unique" ON "reservation_hold_items" USING btree ("hold_id","room_id");--> statement-breakpoint
CREATE INDEX "reservation_hold_items_room_hold_idx" ON "reservation_hold_items" USING btree ("room_id","hold_id");--> statement-breakpoint
CREATE INDEX "reservation_holds_interval_expiry_idx" ON "reservation_holds" USING btree ("check_in","check_out","expires_at");--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP COLUMN "room_id";--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP COLUMN "guest_count";--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP COLUMN "nightly_price_clp";--> statement-breakpoint
ALTER TABLE "reservation_holds" DROP COLUMN "charges_clp";