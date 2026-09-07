CREATE TABLE "company_quotation_breakfast_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text NOT NULL,
	"unit_price_clp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_quotation_breakfast_catalog_price_non_negative" CHECK ("company_quotation_breakfast_catalog"."unit_price_clp" >= 0)
);
--> statement-breakpoint
ALTER TABLE "company_quotations" ADD COLUMN "require_parking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_quotations" ADD COLUMN "breakfast_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_quotations" ADD COLUMN "breakfast_quantity" integer;--> statement-breakpoint
ALTER TABLE "company_quotations" ADD COLUMN "breakfast_unit_price_clp_snapshot" integer;--> statement-breakpoint
ALTER TABLE "company_quotations" ADD COLUMN "breakfast_subtotal_clp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_quotations" ADD CONSTRAINT "company_quotations_breakfast_detail_when_requested" CHECK ((NOT "company_quotations"."breakfast_requested") OR ("company_quotations"."breakfast_quantity" > 0 AND "company_quotations"."breakfast_unit_price_clp_snapshot" >= 0 AND "company_quotations"."breakfast_subtotal_clp" >= 0));