CREATE TABLE "room_occupancy_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"occupancy" integer NOT NULL,
	"price_clp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_occupancy_prices_occupancy_positive" CHECK ("room_occupancy_prices"."occupancy" > 0),
	CONSTRAINT "room_occupancy_prices_price_positive" CHECK ("room_occupancy_prices"."price_clp" > 0)
);
--> statement-breakpoint
ALTER TABLE "reservation_items" ADD COLUMN "guest_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "room_occupancy_prices" ADD CONSTRAINT "room_occupancy_prices_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_occupancy_prices_room_occupancy_unique" ON "room_occupancy_prices" USING btree ("room_id","occupancy");--> statement-breakpoint
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_guest_count_positive" CHECK ("reservation_items"."guest_count" > 0);