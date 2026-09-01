CREATE TYPE "public"."assistant_interaction_status" AS ENUM('proposed', 'confirmed', 'cancelled', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('airbnb', 'booking');--> statement-breakpoint
CREATE TYPE "public"."channel_task_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."company_quotation_status" AS ENUM('accepted', 'delivery_failed', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'processing', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('pay_now', 'pay_at_property');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."reservation_origin" AS ENUM('website', 'airbnb', 'booking', 'phone', 'whatsapp', 'admin');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"instruction" text NOT NULL,
	"interpretation" jsonb,
	"corrections" jsonb,
	"status" "assistant_interaction_status" NOT NULL,
	"proposal_token" varchar(200),
	"expires_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(160) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_sync_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"status" "channel_task_status" DEFAULT 'pending' NOT NULL,
	"completed_by_user_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_sync_tasks_completion_consistent" CHECK (("channel_sync_tasks"."completed_at" IS NULL) = ("channel_sync_tasks"."completed_by_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "company_quotation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"room_slug" varchar(160) NOT NULL,
	"room_name_snapshot" varchar(200) NOT NULL,
	"capacity_snapshot" integer NOT NULL,
	"nightly_price_clp_snapshot" integer NOT NULL,
	"quantity" integer NOT NULL,
	"nights" integer NOT NULL,
	"subtotal_clp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_quotation_lines_capacity_positive" CHECK ("company_quotation_lines"."capacity_snapshot" > 0),
	CONSTRAINT "company_quotation_lines_price_positive" CHECK ("company_quotation_lines"."nightly_price_clp_snapshot" > 0),
	CONSTRAINT "company_quotation_lines_quantity_positive" CHECK ("company_quotation_lines"."quantity" > 0),
	CONSTRAINT "company_quotation_lines_nights_positive" CHECK ("company_quotation_lines"."nights" > 0),
	CONSTRAINT "company_quotation_lines_subtotal_non_negative" CHECK ("company_quotation_lines"."subtotal_clp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "company_quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"company" varchar(200) NOT NULL,
	"contact" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(80) NOT NULL,
	"requirements" text NOT NULL,
	"message" text NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"guest_count" integer NOT NULL,
	"capacity" integer NOT NULL,
	"nights" integer NOT NULL,
	"total_clp" integer NOT NULL,
	"status" "company_quotation_status" DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_quotations_guest_count_positive" CHECK ("company_quotations"."guest_count" > 0),
	CONSTRAINT "company_quotations_capacity_positive" CHECK ("company_quotations"."capacity" > 0),
	CONSTRAINT "company_quotations_nights_positive" CHECK ("company_quotations"."nights" > 0),
	CONSTRAINT "company_quotations_total_non_negative" CHECK ("company_quotations"."total_clp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(160) NOT NULL,
	"last_name" varchar(160) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(80) NOT NULL,
	"rut" varchar(32),
	"company" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"type" varchar(120) NOT NULL,
	"idempotency_key" varchar(200) NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_attempts_non_negative" CHECK ("notification_outbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"provider" varchar(80) NOT NULL,
	"provider_event_id" varchar(200) NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid,
	"hold_id" uuid,
	"provider" varchar(80) NOT NULL,
	"provider_payment_id" varchar(200),
	"external_reference" varchar(200) NOT NULL,
	"amount_clp" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"payment_method" varchar(80),
	"status" "payment_status" NOT NULL,
	"recorded_by_user_id" uuid,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_clp" > 0),
	CONSTRAINT "payments_reference_target" CHECK (("payments"."reservation_id" IS NOT NULL) OR ("payments"."hold_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "reservation_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"guest_count" integer NOT NULL,
	"nightly_price_clp" integer NOT NULL,
	"charges_clp" integer DEFAULT 0 NOT NULL,
	"total_clp" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_holds_interval_valid" CHECK ("reservation_holds"."check_out" > "reservation_holds"."check_in"),
	CONSTRAINT "reservation_holds_guest_count_positive" CHECK ("reservation_holds"."guest_count" > 0),
	CONSTRAINT "reservation_holds_nightly_price_positive" CHECK ("reservation_holds"."nightly_price_clp" > 0),
	CONSTRAINT "reservation_holds_charges_non_negative" CHECK ("reservation_holds"."charges_clp" >= 0),
	CONSTRAINT "reservation_holds_total_non_negative" CHECK ("reservation_holds"."total_clp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"nights" integer NOT NULL,
	"nightly_price_clp" integer NOT NULL,
	"charges_clp" integer DEFAULT 0 NOT NULL,
	"subtotal_clp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_items_nights_positive" CHECK ("reservation_items"."nights" > 0),
	CONSTRAINT "reservation_items_nightly_price_positive" CHECK ("reservation_items"."nightly_price_clp" > 0),
	CONSTRAINT "reservation_items_charges_non_negative" CHECK ("reservation_items"."charges_clp" >= 0),
	CONSTRAINT "reservation_items_subtotal_non_negative" CHECK ("reservation_items"."subtotal_clp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" varchar(80) NOT NULL,
	"guest_id" uuid NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"total_clp" integer NOT NULL,
	"origin" "reservation_origin" NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"status" "reservation_status" NOT NULL,
	"guest_comment" text,
	"invoice_requested" boolean DEFAULT false NOT NULL,
	"invoice_name" varchar(200),
	"invoice_rut" varchar(32),
	"invoice_phone" varchar(80),
	"invoice_business_activity" varchar(200),
	"invoice_email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_interval_valid" CHECK ("reservations"."check_out" > "reservations"."check_in"),
	CONSTRAINT "reservations_total_non_negative" CHECK ("reservations"."total_clp" >= 0),
	CONSTRAINT "reservations_invoice_request_complete" CHECK ("reservations"."invoice_requested" = false OR ("reservations"."invoice_name" IS NOT NULL AND "reservations"."invoice_rut" IS NOT NULL AND "reservations"."invoice_phone" IS NOT NULL AND "reservations"."invoice_business_activity" IS NOT NULL AND "reservations"."invoice_email" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "room_amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"removed_by_user_id" uuid,
	"removed_at" timestamp with time zone,
	"assistant_interaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_blocks_interval_valid" CHECK ("room_blocks"."check_out" > "room_blocks"."check_in"),
	CONSTRAINT "room_blocks_removal_consistent" CHECK (("room_blocks"."removed_at" IS NULL) = ("room_blocks"."removed_by_user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "room_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"alt_text" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_images_position_non_negative" CHECK ("room_images"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(160),
	"name" varchar(200),
	"description" text,
	"capacity" integer,
	"bed_count" integer,
	"bed_configuration" varchar(200),
	"bathroom_description" varchar(200),
	"base_nightly_price_clp" integer,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_capacity_positive" CHECK ("rooms"."capacity" IS NULL OR "rooms"."capacity" > 0),
	CONSTRAINT "rooms_bed_count_positive" CHECK ("rooms"."bed_count" IS NULL OR "rooms"."bed_count" > 0),
	CONSTRAINT "rooms_nightly_price_positive" CHECK ("rooms"."base_nightly_price_clp" IS NULL OR "rooms"."base_nightly_price_clp" > 0),
	CONSTRAINT "rooms_active_complete" CHECK ("rooms"."active" = false OR ("rooms"."slug" IS NOT NULL AND "rooms"."name" IS NOT NULL AND "rooms"."capacity" IS NOT NULL AND "rooms"."bed_count" IS NOT NULL AND "rooms"."base_nightly_price_clp" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "channel_sync_tasks" ADD CONSTRAINT "channel_sync_tasks_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_quotation_lines" ADD CONSTRAINT "company_quotation_lines_quotation_id_company_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."company_quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_hold_id_reservation_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."reservation_holds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_holds" ADD CONSTRAINT "reservation_holds_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_holds" ADD CONSTRAINT "reservation_holds_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_amenities" ADD CONSTRAINT "room_amenities_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_amenities" ADD CONSTRAINT "room_amenities_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_assistant_interaction_id_assistant_interactions_id_fk" FOREIGN KEY ("assistant_interaction_id") REFERENCES "public"."assistant_interactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_images" ADD CONSTRAINT "room_images_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amenities_slug_unique" ON "amenities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_interactions_proposal_token_unique" ON "assistant_interactions" USING btree ("proposal_token");--> statement-breakpoint
CREATE INDEX "assistant_interactions_status_expiry_idx" ON "assistant_interactions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_sync_tasks_reservation_channel_unique" ON "channel_sync_tasks" USING btree ("reservation_id","channel");--> statement-breakpoint
CREATE INDEX "channel_sync_tasks_status_idx" ON "channel_sync_tasks" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "company_quotation_lines_quotation_idx" ON "company_quotation_lines" USING btree ("quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_quotations_idempotency_key_unique" ON "company_quotations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "company_quotations_created_idx" ON "company_quotations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_idempotency_key_unique" ON "notification_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_status_created_idx" ON "notification_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_unique" ON "payment_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_events_payment_occurred_idx" ON "payment_events" USING btree ("payment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_unique" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_reservation_status_idx" ON "payments" USING btree ("reservation_id","status");--> statement-breakpoint
CREATE INDEX "reservation_holds_room_interval_expiry_idx" ON "reservation_holds" USING btree ("room_id","check_in","check_out","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_items_reservation_room_unique" ON "reservation_items" USING btree ("reservation_id","room_id");--> statement-breakpoint
CREATE INDEX "reservation_items_room_reservation_idx" ON "reservation_items" USING btree ("room_id","reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_public_id_unique" ON "reservations" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "reservations_check_in_check_out_idx" ON "reservations" USING btree ("check_in","check_out");--> statement-breakpoint
CREATE UNIQUE INDEX "room_amenities_room_amenity_unique" ON "room_amenities" USING btree ("room_id","amenity_id");--> statement-breakpoint
CREATE INDEX "room_blocks_room_interval_idx" ON "room_blocks" USING btree ("room_id","check_in","check_out");--> statement-breakpoint
CREATE UNIQUE INDEX "room_images_room_position_unique" ON "room_images" USING btree ("room_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_slug_unique" ON "rooms" USING btree ("slug");