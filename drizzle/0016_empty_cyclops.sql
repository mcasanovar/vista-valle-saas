CREATE TABLE "channel_platform_pauses" (
	"platform" "channel" PRIMARY KEY NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
